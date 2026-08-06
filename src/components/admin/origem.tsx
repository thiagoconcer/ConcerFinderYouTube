import { Compass } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { larguraDaFatia } from '@/lib/grafico'
import type { OrigemInsights } from '@/types/search'

const pct = (parte: number, todo: number) => (todo === 0 ? 0 : Math.round((parte / todo) * 100))

/**
 * De onde vêm os leads.
 *
 * A coluna que importa não é "quantos", é "quantos ativaram": origem que traz
 * volume e ninguém busca é tráfego, não audiência. É essa diferença que diz
 * onde vale gastar esforço.
 */
export function Origem({ dados }: { dados: OrigemInsights | null }) {
  const origens = dados?.por_origem ?? []
  const campanhas = dados?.por_campanha ?? []
  const total = dados?.total_leads ?? 0

  return (
    <div className="mb-8 grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Compass className="size-4.5 text-primary" aria-hidden="true" />
            De onde vêm os leads
          </CardTitle>
          <CardDescription>
            Quem trouxe cada pessoa, e quantas delas chegaram a buscar de verdade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {origens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum lead no período. A origem começa a ser registrada nos cadastros novos.
            </p>
          ) : (
            <ul className="space-y-3">
              {origens.map((o) => (
                <li key={o.origem}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{o.origem}</span>
                    <span className="shrink-0 tabular-nums">
                      <strong>{o.leads}</strong>
                      <span className="ml-2 text-muted-foreground">
                        {o.ativaram} ativaram ({pct(o.ativaram, o.leads)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
                    {/* Barra cheia = volume; a parte sólida = quem ativou */}
                    <div
                      className="h-full rounded-full bg-primary/30"
                      style={{ width: larguraDaFatia(o.leads, total) }}
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct(o.ativaram, o.leads)}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campanhas marcadas</CardTitle>
          <CardDescription>
            Só aparece o que veio com <code className="text-xs">utm_campaign</code> no link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campanhas.length === 0 ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Nenhuma campanha marcada ainda.</p>
              <p>
                Para medir uma, é só acrescentar os parâmetros ao link que você divulga:
                <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">
                  finder.thiagoconcer.com.br/?utm_source=instagram&amp;utm_medium=stories&amp;utm_campaign=lancamento
                </code>
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {campanhas.map((c) => (
                <li
                  key={`${c.origem}-${c.meio}-${c.campanha}`}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.campanha}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.origem} · {c.meio}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <Badge variant="secondary">{c.leads}</Badge>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {c.ativaram} ativaram
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
