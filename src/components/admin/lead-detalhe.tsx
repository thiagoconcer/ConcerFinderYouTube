import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { ROUTES } from '@/lib/routes'
import { formatDateTime, formatTimestamp, topicLabel } from '@/lib/format'
import type { LeadDetalheDados, SituacaoNutricao } from '@/types/leads'

const ETAPAS = [
  { chave: 'd0', rotulo: 'E-mail 1', quando: 'no dia' },
  { chave: 'd2', rotulo: 'E-mail 2', quando: '2 dias' },
  { chave: 'd5', rotulo: 'E-mail 3', quando: '5 dias' },
  { chave: 'd9', rotulo: 'E-mail 4', quando: '9 dias' },
]

/**
 * Ficha da pessoa: o que ela buscou, o que abriu e onde está na régua.
 *
 * Carrega sob demanda, ao abrir. Puxar a ficha completa de todo mundo junto
 * com a lista seria trazer, para a tela inteira, um dado que só é olhado uma
 * pessoa por vez.
 */
export function LeadDetalhe({
  profileId,
  situacao,
}: {
  profileId: string
  situacao: SituacaoNutricao | null
}) {
  const [dados, setDados] = useState<LeadDetalheDados | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let ativo = true
    void (async () => {
      const { data, error } = await supabase.rpc('get_lead_detail', { p_profile_id: profileId })
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
  }, [profileId])

  if (erro) {
    return (
      <p className="mt-4 border-t pt-4 text-sm text-destructive">
        Não foi possível carregar a ficha desta pessoa.
      </p>
    )
  }

  if (!dados) {
    return (
      <div className="mt-4 space-y-2 border-t pt-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  const alcancou = (chave: string) => {
    if (!situacao?.etapa) return false
    return ETAPAS.findIndex((e) => e.chave === chave) <= ETAPAS.findIndex((e) => e.chave === situacao.etapa)
  }

  return (
    <div className="mt-4 space-y-6 border-t pt-4">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { r: 'Buscas', v: dados.resumo.total_buscas },
          { r: 'Dias ativos', v: dados.resumo.dias_ativos },
          { r: 'Recebeu', v: `${dados.resumo.recomendacoes_recebidas} trechos` },
          { r: 'Abriu', v: `${dados.resumo.trechos_abertos} trechos` },
        ].map((m) => (
          <div key={m.r} className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">{m.r}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{m.v}</p>
          </div>
        ))}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Régua de nutrição</h3>
        {situacao?.fluxo ? (
          <ol className="flex flex-wrap gap-x-6 gap-y-2">
            {ETAPAS.map((e) => {
              const ok = alcancou(e.chave)
              return (
                <li key={e.chave} className="flex items-center gap-1.5 text-sm">
                  {ok ? (
                    <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className={ok ? '' : 'text-muted-foreground'}>{e.rotulo}</span>
                  <span className="text-xs text-muted-foreground">({e.quando})</span>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ainda não entrou em nenhuma régua. O gatilho só é aplicado depois da primeira busca,
            porque é ela que dá ao primeiro e-mail a dor real da pessoa.
          </p>
        )}
        {situacao?.fluxo && (
          <p className="mt-2 text-sm text-muted-foreground">
            Fluxo <Badge variant="secondary">{situacao.fluxo}</Badge>{' '}
            {situacao.rotulo && `· ${situacao.rotulo}`}
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">
          O que essa pessoa procurou ({dados.buscas.length})
        </h3>
        {dados.buscas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cadastrou-se e ainda não buscou nada.</p>
        ) : (
          <ul className="space-y-2">
            {dados.buscas.map((b) => (
              <li key={b.busca_id} className="rounded-lg border p-3">
                <p className="text-sm">“{b.dor}”</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatDateTime(b.buscado_em)}</span>
                  <span>
                    {b.trechos_abertos} de {b.trechos_recomendados} trechos abertos
                  </span>
                  {b.gerou_plano && <Badge variant="outline">plano de ação</Badge>}
                  {b.temas.map((t) => (
                    <Badge key={t} variant="secondary" className="font-normal">
                      {topicLabel(t)}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dados.aberturas.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold">
            O que abriu de verdade ({dados.aberturas.length})
          </h3>
          <ul className="space-y-2">
            {dados.aberturas.slice(0, 10).map((a, i) => (
              <li key={`${a.video_id}-${a.aberto_em}-${i}`}>
                <Link
                  to={`${ROUTES.video(a.video_id)}?t=${a.inicio_segundos}`}
                  className="flex items-start gap-2 rounded-lg p-2 text-sm transition-colors hover:bg-accent/50"
                >
                  <PlayCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="line-clamp-1">{a.titulo}</span>
                    <span className="text-xs text-muted-foreground">
                      minuto {formatTimestamp(a.inicio_segundos)} · {formatDateTime(a.aberto_em)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
