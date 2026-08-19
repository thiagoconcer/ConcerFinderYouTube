import { Handshake } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/lib/routes'
import { formatDateTime, topicLabel } from '@/lib/format'
import { larguraDaFatia } from '@/lib/grafico'
import { COMMERCIAL_ROLE_LABELS } from '@/types/database'
import type { CommercialRole } from '@/types/database'
import type { CtaInsights } from '@/types/search'

const pct = (parte: number, todo: number) => (todo === 0 ? 0 : Math.round((parte / todo) * 100))

/**
 * O CTA de parceiro no plano de ação.
 *
 * O número que interessa não é quantos cliques: cliques sobem junto com o
 * tráfego e não dizem se o convite funciona. O que responde é a taxa, de quem
 * VIU quantos clicaram, e é a mesma leitura do relatório de origem.
 *
 * Só entram no denominador as pessoas que de fato tiveram o convite na frente:
 * plano com a seção de IA e perfil que recebe o botão. Planos gerados antes do
 * CTA existir ficam de fora, senão a taxa nasceria diluída por buscas que nunca
 * tiveram chance de converter.
 */
export function Cta({ dados }: { dados: CtaInsights | null }) {
  const viram = dados?.pessoas_que_viram ?? 0
  const clicaram = dados?.pessoas_que_clicaram ?? 0
  const perfis = dados?.por_perfil ?? []
  const temas = dados?.por_tema ?? []
  const ultimos = dados?.ultimos ?? []

  const nunca = viram === 0 && clicaram === 0

  return (
    <div className="mb-8 grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Handshake className="size-4.5 text-primary" aria-hidden="true" />
            Convite do Viver de IA
          </CardTitle>
          <CardDescription>
            De quem teve o convite na frente, quantos clicaram. Só conta dono e gestor, que
            são os perfis que recebem o botão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {nunca ? (
            <p className="text-sm text-muted-foreground">
              Nenhum plano com o convite ainda no período. Ele entra nas buscas novas, e
              planos gerados antes não têm a seção.
            </p>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <div>
                  <p className="text-3xl font-semibold tabular-nums">{pct(clicaram, viram)}%</p>
                  <p className="text-xs text-muted-foreground">clicaram</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{clicaram}</strong> de{' '}
                  <strong className="text-foreground">{viram}</strong> pessoas que viram,
                  em <strong className="text-foreground">{dados?.cliques ?? 0}</strong>{' '}
                  clique(s) e {dados?.planos_com_convite ?? 0} plano(s) com convite.
                </p>
              </div>

              <ul className="space-y-3">
                {perfis.map((p) => (
                  <li key={p.perfil}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">
                        {COMMERCIAL_ROLE_LABELS[p.perfil as CommercialRole] ?? p.perfil}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {p.clicaram} de {p.viram} ({pct(p.clicaram, p.viram)}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
                      <div
                        className="h-full rounded-full bg-primary/30"
                        style={{ width: larguraDaFatia(p.viram, viram) }}
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct(p.clicaram, p.viram)}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Depois de qual dor a pessoa clica</CardTitle>
          <CardDescription>
            O tema que precedeu o clique. Vira pauta de conteúdo e argumento de campanha,
            não só número de relatório.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {temas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum clique registrado ainda.</p>
          ) : (
            <ul className="mb-5 space-y-2">
              {temas.map((t) => (
                <li key={t.tema} className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{topicLabel(t.tema)}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {t.cliques}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {ultimos.length > 0 && (
            <div className="border-t pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Quem clicou por último
              </p>
              <ul className="space-y-2">
                {ultimos.map((u, i) => (
                  <li key={`${u.profile_id}-${i}`} className="text-sm">
                    <Link
                      to={ROUTES.adminLeadPerfil(u.profile_id)}
                      className="font-medium hover:underline"
                    >
                      {u.nome}
                    </Link>
                    <span className="text-muted-foreground">
                      {' '}
                      {formatDateTime(u.clicado_em)}
                    </span>
                    {u.dor && (
                      <p className="truncate text-xs text-muted-foreground">{u.dor}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
