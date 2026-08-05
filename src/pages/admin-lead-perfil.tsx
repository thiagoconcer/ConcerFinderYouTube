import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Phone } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LeadDetalhe } from '@/components/admin/lead-detalhe'
import { supabase } from '@/lib/supabase'
import { ROUTES } from '@/lib/routes'
import { formatDateTime } from '@/lib/format'
import { CARGO_LABELS, COMMERCIAL_ROLE_LABELS } from '@/types/database'
import type { Cargo, CommercialRole } from '@/types/database'
import type { LeadDetalheDados, SituacaoNutricao } from '@/types/leads'

/**
 * /admin/leads/:id
 * Perfil completo de uma pessoa, em página própria.
 *
 * Existe como rota, e não só como sanfona dentro da lista, porque o perfil
 * precisa ser LINKÁVEL: do histórico de buscas, do painel, de uma conversa no
 * WhatsApp entre a equipe. Endereço próprio é o que torna isso possível.
 */
export function AdminLeadPerfilPage() {
  const { id } = useParams<{ id: string }>()
  const [dados, setDados] = useState<LeadDetalheDados | null>(null)
  const [situacao, setSituacao] = useState<SituacaoNutricao | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (!id) return
    let ativo = true
    void (async () => {
      const { data, error } = await supabase.rpc('get_lead_detail', { p_profile_id: id })
      if (!ativo) return
      if (error) {
        setErro(true)
        return
      }
      setDados(data as unknown as LeadDetalheDados)
    })()
    return () => {
      ativo = false
    }
  }, [id])

  // A régua vive no ActiveCampaign; sem ela a página continua útil.
  useEffect(() => {
    const email = dados?.pessoa?.email
    if (!email) return
    let ativo = true
    void (async () => {
      try {
        const { data } = await supabase.functions.invoke('nurture-status')
        if (!ativo || !data?.disponivel) return
        setSituacao(data.situacoes?.[email.toLowerCase()] ?? null)
      } catch {
        /* silencioso: é informação complementar */
      }
    })()
    return () => {
      ativo = false
    }
  }, [dados?.pessoa?.email])

  const pessoa = dados?.pessoa

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
        <Link to={ROUTES.adminLeads}>
          <ArrowLeft />
          Todos os leads
        </Link>
      </Button>

      {erro && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar</AlertTitle>
          <AlertDescription>
            Essa pessoa não existe ou você não tem acesso a ela.
          </AlertDescription>
        </Alert>
      )}

      {!erro && !pessoa && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {pessoa && (
        <>
          <header className="mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">{pessoa.nome}</h1>
              {pessoa.cargo && (
                <Badge variant="secondary">
                  {CARGO_LABELS[pessoa.cargo as Cargo] ?? pessoa.cargo}
                </Badge>
              )}
              <Badge variant="outline">
                {COMMERCIAL_ROLE_LABELS[pessoa.perfil_comercial as CommercialRole] ??
                  pessoa.perfil_comercial}
              </Badge>
              {pessoa.papel !== 'user' && <Badge>{pessoa.papel}</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <a href={`mailto:${pessoa.email}`} className="flex items-center gap-1.5 hover:underline">
                <Mail className="size-3.5" aria-hidden="true" />
                {pessoa.email}
              </a>
              <a
                href={`https://wa.me/55${pessoa.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:underline"
              >
                <Phone className="size-3.5" aria-hidden="true" />
                {pessoa.whatsapp}
              </a>
              <span>cadastrou-se em {formatDateTime(pessoa.cadastrado_em)}</span>
            </div>
          </header>

          {id && <LeadDetalhe profileId={id} situacao={situacao} />}
        </>
      )}
    </div>
  )
}
