import { Link } from 'react-router-dom'
import { Eye, PlayCircle, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/lib/routes'
import { formatTimestamp } from '@/lib/format'
import type { TrechoRanking } from '@/types/search'

/**
 * Ranking de trechos do painel de audiência.
 *
 * São duas leituras diferentes e a distância entre elas é o insight:
 *  - recomendados: o que a busca semântica devolveu
 *  - assistidos:   o que as pessoas realmente abriram
 * Um trecho muito recomendado e pouco assistido é sinal de título ou
 * minutagem que não convence; muito assistido é pauta que engaja.
 */
export function RankingTrechos({
  titulo,
  descricao,
  trechos,
  tipo,
}: {
  titulo: string
  descricao: string
  trechos: TrechoRanking[]
  tipo: 'recomendado' | 'assistido'
}) {
  const Icone = tipo === 'recomendado' ? Sparkles : Eye
  const maior = trechos[0]?.vezes ?? 1

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icone className="size-4.5 text-primary" aria-hidden="true" />
          {titulo}
        </CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent>
        {trechos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tipo === 'recomendado'
              ? 'Nenhuma recomendação ainda.'
              : 'Ninguém abriu um trecho ainda. O número aparece conforme as pessoas clicam nas recomendações.'}
          </p>
        ) : (
          <ol className="space-y-3">
            {trechos.slice(0, 8).map((t, i) => (
              <li key={`${t.segment_id ?? t.video_id}-${i}`}>
                <Link
                  to={`${ROUTES.video(t.video_id)}?t=${t.start_seconds}${t.segment_id ? `&s=${t.segment_id}` : ''}`}
                  className="group block rounded-lg border p-3 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold tabular-nums text-primary"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium group-hover:underline">
                        {t.title}
                      </p>
                      {t.trecho && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          “{t.trecho}”
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-1">
                          <PlayCircle className="size-3" />
                          min {formatTimestamp(t.start_seconds)}
                        </Badge>
                        <Badge variant="outline" className="tabular-nums">
                          {t.vezes}
                          {tipo === 'recomendado' ? '× recomendado' : '× aberto'}
                        </Badge>
                        {typeof t.score_medio === 'number' && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            relevância média {Math.round(t.score_medio * 100)}%
                          </span>
                        )}
                      </div>
                      <div
                        className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
                        role="presentation"
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(6, (t.vezes / maior) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
