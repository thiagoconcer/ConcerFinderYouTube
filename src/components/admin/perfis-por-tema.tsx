import { Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { topicLabel } from '@/lib/format'
import { COMMERCIAL_ROLE_LABELS } from '@/types/database'
import type { CommercialRole } from '@/types/database'
import type { AudienceInsights } from '@/types/search'

/**
 * "Quem procura o quê": para cada perfil comercial, os temas que ele mais
 * busca. É a leitura que sustenta a proposta comercial do produto, porque é
 * ela que permite dizer a um parceiro "temos X donos de empresa procurando
 * gestão de equipe".
 */
export function PerfisPorTema({ perfis }: { perfis: AudienceInsights['perfis_por_tema'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="size-4.5 text-primary" aria-hidden="true" />
          Quem procura o quê
        </CardTitle>
        <CardDescription>
          Os temas que cada perfil comercial mais busca. É o corte que interessa a um parceiro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {perfis.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem buscas suficientes ainda.</p>
        ) : (
          <div className="space-y-6">
            {perfis.map((p) => {
              const maior = p.temas[0]?.total ?? 1
              return (
                <div key={p.commercial_role}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold">
                      {COMMERCIAL_ROLE_LABELS[p.commercial_role as CommercialRole] ??
                        p.commercial_role}
                    </h4>
                    <Badge variant="secondary" className="tabular-nums">
                      {p.total} {p.total === 1 ? 'busca' : 'buscas'}
                    </Badge>
                  </div>
                  <ul className="space-y-2">
                    {p.temas.slice(0, 5).map((t) => (
                      <li key={t.topico}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-muted-foreground">
                            {topicLabel(t.topico)}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {t.total}
                          </span>
                        </div>
                        <div
                          className="h-1.5 overflow-hidden rounded-full bg-muted"
                          role="presentation"
                        >
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(6, (t.total / maior) * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
