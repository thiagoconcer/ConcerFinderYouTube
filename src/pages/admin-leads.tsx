import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ChevronRight, Mail, Phone, RefreshCw, Search as SearchIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ROUTES } from '@/lib/routes'
import { formatDateTime, topicLabel } from '@/lib/format'
import { CARGO_LABELS, COMMERCIAL_ROLE_LABELS } from '@/types/database'
import type { Cargo, CommercialRole } from '@/types/database'
import type { LeadResumo, SituacaoNutricao } from '@/types/leads'

/**
 * /admin/leads
 * Pessoa a pessoa: quem se cadastrou, o que buscou, o que abriu de verdade e
 * em que ponto da régua de nutrição está.
 *
 * Separada do dashboard de propósito. O painel agregado responde "como vai a
 * audiência"; esta página responde "quem é essa pessoa e o que faço com ela".
 * São usos com ritmos diferentes, e juntos um atrapalhava o outro.
 *
 * A fase da nutrição não mora no nosso banco, mora no ActiveCampaign. Vem da
 * Edge Function nurture-status, e se ela falhar a lista continua útil: o dado
 * de comportamento é nosso.
 */

const TODOS = 'todos'

const ROTULO_ETAPA: Record<string, string> = {
  d0: 'E-mail 1',
  d2: 'E-mail 2',
  d5: 'E-mail 3',
  d9: 'Concluída',
}

export function AdminLeadsPage() {
  const [leads, setLeads] = useState<LeadResumo[] | null>(null)
  const [nutricao, setNutricao] = useState<Record<string, SituacaoNutricao> | null>(null)
  const [nutricaoIndisponivel, setNutricaoIndisponivel] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [perfil, setPerfil] = useState<string>(TODOS)

  const carregar = useCallback(async () => {
    setErro(null)
    setLeads(null)

    const { data, error } = await supabase.rpc('get_leads', {
      p_busca: termo || undefined,
      p_perfil: perfil === TODOS ? undefined : perfil,
      p_limit: 200,
    })

    if (error) {
      setErro('Não foi possível carregar os leads.')
      setLeads([])
      return
    }
    setLeads((data as unknown as LeadResumo[]) ?? [])
  }, [termo, perfil])

  // Consulta separada e sem bloquear a lista: o ActiveCampaign é um terceiro,
  // e a lentidão ou a queda dele não pode segurar o dado que já é nosso.
  const carregarNutricao = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('nurture-status')
      if (error || !data?.disponivel) {
        setNutricaoIndisponivel(true)
        return
      }
      setNutricao(data.situacoes ?? {})
      setNutricaoIndisponivel(false)
    } catch {
      setNutricaoIndisponivel(true)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    void carregarNutricao()
  }, [carregarNutricao])

  function submeterBusca(e: React.FormEvent) {
    e.preventDefault()
    setTermo(busca.trim())
  }

  const situacaoDe = (email: string) => nutricao?.[email.toLowerCase()] ?? null

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-10 sm:px-8 sm:py-12">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-2 text-muted-foreground">
            Quem se cadastrou, o que cada um procurou e onde está na régua de nutrição.
          </p>
        </div>
        <Button variant="outline" onClick={() => { void carregar(); void carregarNutricao() }}>
          <RefreshCw />
          Atualizar
        </Button>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <form onSubmit={submeterBusca} className="flex min-w-64 flex-1 gap-2">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, e-mail, WhatsApp ou o que a pessoa buscou"
            aria-label="Buscar lead"
          />
          <Button type="submit" variant="secondary">
            <SearchIcon />
            Buscar
          </Button>
        </form>
        <Select value={perfil} onValueChange={setPerfil}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todos os perfis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os perfis</SelectItem>
            {(Object.keys(COMMERCIAL_ROLE_LABELS) as CommercialRole[]).map((p) => (
              <SelectItem key={p} value={p}>
                {COMMERCIAL_ROLE_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {erro && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {nutricaoIndisponivel && (
        <Alert className="mb-6">
          <AlertCircle />
          <AlertTitle>Régua de nutrição indisponível</AlertTitle>
          <AlertDescription>
            Não foi possível consultar o ActiveCampaign agora. Os dados de comportamento abaixo
            são do ConcerFinder e continuam corretos.
          </AlertDescription>
        </Alert>
      )}

      {leads === null && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {leads !== null && leads.length === 0 && (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {termo || perfil !== TODOS
              ? 'Nenhum lead para esse filtro.'
              : 'Nenhum lead cadastrado ainda.'}
          </CardContent>
        </Card>
      )}

      {leads !== null && leads.length > 0 && (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {leads.length} {leads.length === 1 ? 'pessoa' : 'pessoas'}
          </p>
          <ul className="space-y-3">
            {leads.map((lead) => {
              const situacao = situacaoDe(lead.email)
              return (
                <li key={lead.profile_id}>
                  <Card>
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-semibold">
                              <Link
                                to={ROUTES.adminLeadPerfil(lead.profile_id)}
                                className="hover:underline"
                              >
                                {lead.nome}
                              </Link>
                            </h2>
                            {lead.cargo && (
                              <Badge variant="secondary">
                                {CARGO_LABELS[lead.cargo as Cargo] ?? lead.cargo}
                              </Badge>
                            )}
                            {situacao?.fluxo && (
                              <Badge variant="outline">
                                régua {situacao.fluxo}
                                {situacao.etapa ? ` · ${ROTULO_ETAPA[situacao.etapa]}` : ''}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Mail className="size-3.5" aria-hidden="true" />
                              {lead.email}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Phone className="size-3.5" aria-hidden="true" />
                              {lead.whatsapp}
                            </span>
                            <span>desde {formatDateTime(lead.cadastrado_em)}</span>
                          </div>
                          {lead.ultima_dor && (
                            <p className="mt-2 line-clamp-1 text-sm">
                              <span className="text-muted-foreground">última dor: </span>
                              “{lead.ultima_dor}”
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-4">
                          <div className="text-right text-sm">
                            <div className="tabular-nums">
                              <strong>{lead.total_buscas}</strong>{' '}
                              <span className="text-muted-foreground">
                                {lead.total_buscas === 1 ? 'busca' : 'buscas'}
                              </span>
                            </div>
                            <div className="tabular-nums text-muted-foreground">
                              {lead.trechos_abertos} abertos
                            </div>
                          </div>
                          <Button asChild variant="outline" size="sm">
                            <Link to={ROUTES.adminLeadPerfil(lead.profile_id)}>
                              Ver perfil
                              <ChevronRight />
                            </Link>
                          </Button>
                        </div>
                      </div>

                      {lead.temas.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-1.5">
                          {lead.temas.slice(0, 6).map((t) => (
                            <li key={t}>
                              <Badge variant="outline" className="font-normal">
                                {topicLabel(t)}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}

                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
