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

const FAIXA_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  quente: 'default',
  morno: 'secondary',
  frio: 'outline',
}

/**
 * Explica a nota em uma frase, com as parcelas que o banco devolveu.
 *
 * Não recalcula nada: os pontos vêm de score_do_lead. Reimplementar a regra
 * aqui daria dois números diferentes na primeira vez que um peso mudasse.
 */
function explicaScore(lead: LeadResumo): string {
  return (
    `${lead.score}/100. Cargo, atividade (${lead.total_buscas} busca(s), ` +
    `${lead.trechos_abertos} trecho(s) aberto(s), clique no convite do parceiro), ` +
    'recência e foco de tema. Comportamento pesa mais que cargo: quem se cadastra e não volta não passa de 30.'
  )
}

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

          {/* Tabela, e não cards: a leitura aqui é comparar pessoas entre si,
              e coluna alinhada faz isso melhor que bloco. O overflow fica no
              contêiner para a página nunca rolar de lado. */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium" title="Cargo (0-30), atividade (0-45), recência (0-15) e foco de tema (0-10). A lista vem ordenada por ele.">
                    Score
                  </th>
                  <th className="px-4 py-3 font-medium">Pessoa</th>
                  <th className="px-4 py-3 font-medium">Cargo</th>
                  <th className="px-4 py-3 font-medium">Régua</th>
                  <th className="px-4 py-3 text-right font-medium">Buscas</th>
                  <th className="px-4 py-3 font-medium">Palavras buscadas</th>
                  <th className="px-4 py-3 font-medium">Último acesso</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const situacao = situacaoDe(lead.email)
                  return (
                    <tr key={lead.profile_id} className="border-b last:border-0 align-top">
                      {/* Número primeiro, faixa embaixo. Quem varre a lista lê
                          a cor; quem compara duas pessoas próximas lê o número.
                          O title abre a composição para o score não ser um
                          oráculo: sem isso ninguém confia nem contesta. */}
                      <td className="px-4 py-3">
                        <div className="text-lg font-semibold tabular-nums" title={explicaScore(lead)}>
                          {lead.score}
                        </div>
                        <Badge
                          variant={FAIXA_VARIANT[lead.faixa] ?? 'outline'}
                          className="mt-1 font-normal"
                        >
                          {lead.faixa}
                        </Badge>
                      </td>

                      <td className="px-4 py-3">
                        <Link
                          to={ROUTES.adminLeadPerfil(lead.profile_id)}
                          className="font-medium hover:underline"
                        >
                          {lead.nome}
                        </Link>
                        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Mail className="size-3" aria-hidden="true" />
                            {lead.email}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Phone className="size-3" aria-hidden="true" />
                            {lead.whatsapp}
                          </div>
                        </div>
                      </td>

                      {/* Sem cargo, o perfil comercial sobe e ocupa a linha
                          principal. Os cadastros anteriores ao campo cargo nao
                          tem o que mostrar ali, e um "nao informado" em
                          destaque so ocupa espaco dizendo que falta algo que a
                          pessoa nunca teve como preencher. */}
                      <td className="px-4 py-3">
                        {lead.cargo ? (
                          <>
                            <Badge variant="secondary" className="font-normal">
                              {CARGO_LABELS[lead.cargo as Cargo] ?? lead.cargo}
                            </Badge>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {COMMERCIAL_ROLE_LABELS[lead.perfil_comercial as CommercialRole] ??
                                lead.perfil_comercial}
                            </div>
                          </>
                        ) : (
                          <span>
                            {COMMERCIAL_ROLE_LABELS[lead.perfil_comercial as CommercialRole] ??
                              lead.perfil_comercial}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {situacao?.fluxo ? (
                          <>
                            <Badge variant="outline" className="font-normal">
                              {situacao.fluxo}
                            </Badge>
                            {situacao.etapa && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {ROTULO_ETAPA[situacao.etapa]}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">fora da régua</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        <div className="font-medium">{lead.total_buscas}</div>
                        <div className="text-xs text-muted-foreground">
                          {lead.trechos_abertos} abertos
                        </div>
                      </td>

                      <td className="max-w-72 px-4 py-3">
                        {lead.temas.length > 0 ? (
                          <ul className="flex flex-wrap gap-1">
                            {lead.temas.slice(0, 4).map((t) => (
                              <li key={t}>
                                <Badge variant="outline" className="font-normal">
                                  {topicLabel(t)}
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-muted-foreground">ainda não buscou</span>
                        )}
                        {lead.ultima_dor && (
                          // title no elemento: a dor inteira fica a um hover,
                          // sem esticar a linha da tabela.
                          <p
                            className="mt-1.5 line-clamp-2 text-xs text-muted-foreground"
                            title={lead.ultima_dor}
                          >
                            “{lead.ultima_dor}”
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(lead.ultima_atividade)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link to={ROUTES.adminLeadPerfil(lead.profile_id)}>
                            Ver perfil
                            <ChevronRight />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

    </div>
  )
}
