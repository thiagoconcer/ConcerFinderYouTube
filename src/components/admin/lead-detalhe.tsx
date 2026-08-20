import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronDown, Circle, PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { BuscaDetalhe } from '@/components/admin/busca-detalhe'
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
  /** Qual busca está aberta. Uma por vez: a leitura é comparar, não empilhar. */
  const [buscaAberta, setBuscaAberta] = useState<string | null>(null)

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

  const score = dados.score

  return (
    <div className="mt-4 space-y-6 border-t pt-4">
      {/* O score com as parcelas abertas. Um número sozinho vira oráculo:
          ninguém confia e ninguém contesta. Com a composição à vista, a equipe
          vê que a pessoa pontuou por ter voltado três dias, e não por ser dono
          de empresa, e pode discordar do peso em vez de ignorar o número. */}
      <section className="rounded-lg border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">{score.total}</span>
            <span className="text-sm text-muted-foreground">de 100</span>
          </div>
          <Badge variant={score.total >= 70 ? 'default' : score.total >= 40 ? 'secondary' : 'outline'}>
            {dados.faixa}
          </Badge>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
          {[
            { r: 'Cargo', v: score.cargo, de: 30 },
            { r: 'Atividade', v: score.atividade, de: 45 },
            { r: 'Recência', v: score.recencia, de: 15 },
            { r: 'Foco de tema', v: score.foco, de: 10 },
          ].map((c) => (
            <div key={c.r} className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{c.r}</span>
              <span className="tabular-nums">
                {c.v}
                <span className="text-xs text-muted-foreground">/{c.de}</span>
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Comportamento pesa mais que cargo (70 dos 100 pontos): quem se cadastra e não
          volta não passa de 30, mesmo sendo dono de empresa.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { r: 'Buscas', v: dados.resumo.total_buscas },
          { r: 'Dias ativos', v: dados.resumo.dias_ativos },
          { r: 'Recebeu', v: `${dados.resumo.recomendacoes_recebidas} trechos` },
          { r: 'Abriu', v: `${dados.resumo.trechos_abertos} trechos` },
          // Sinal de intenção mais forte da ferramenta: levantou a mão para o
          // parceiro. Zero também informa, por isso o tile é fixo.
          { r: 'Convite do parceiro', v: `${dados.resumo.cliques_cta ?? 0} clique(s)` },
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
            {dados.buscas.map((b) => {
              const aberta = buscaAberta === b.busca_id
              return (
                <li key={b.busca_id} className="rounded-lg border p-3">
                  {/* A linha inteira abre a busca: a pergunta da equipe quase
                      nunca para na dor, ela continua em "e o que ele recebeu?" */}
                  <button
                    type="button"
                    onClick={() => setBuscaAberta(aberta ? null : b.busca_id)}
                    aria-expanded={aberta}
                    className="flex w-full items-start gap-2 text-left"
                  >
                    <ChevronDown
                      className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${
                        aberta ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">“{b.dor}”</span>
                      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatDateTime(b.buscado_em)}</span>
                        <span>
                          {b.trechos_abertos} de {b.trechos_recomendados} trechos abertos
                        </span>
                        {b.gerou_plano && <Badge variant="outline">plano de ação</Badge>}
                        {b.respondeu_contexto && (
                          <Badge variant="outline">respondeu o contexto</Badge>
                        )}
                        {b.temas.map((t) => (
                          <Badge key={t} variant="secondary" className="font-normal">
                            {topicLabel(t)}
                          </Badge>
                        ))}
                      </span>
                    </span>
                  </button>
                  {aberta && <BuscaDetalhe searchId={b.busca_id} />}
                </li>
              )
            })}
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
