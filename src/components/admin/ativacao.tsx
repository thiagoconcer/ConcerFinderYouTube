import { AlertTriangle, Repeat, Target } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { EngagementInsights } from '@/types/search'

const pct = (parte: number, todo: number) => (todo === 0 ? 0 : Math.round((parte / todo) * 100))

/**
 * A tese do produto é que o cadastro obrigatório gera lead qualificado. Só que
 * quem se cadastra e nunca busca não é lead qualificado, é e-mail. Este funil
 * é o que separa os dois, e é a leitura que faltava no painel.
 *
 * Vai sobre a base inteira, não sobre o período: é a saúde do produto, não a
 * do mês.
 */
export function Ativacao({
  funil,
  qualidade,
  recorrencia,
}: {
  funil: EngagementInsights['funil']
  qualidade: EngagementInsights['qualidade']
  recorrencia: EngagementInsights['recorrencia']
}) {
  const etapas = [
    { rotulo: 'Se cadastraram', valor: funil.cadastraram, nota: 'a base inteira' },
    { rotulo: 'Fizeram ao menos uma busca', valor: funil.buscaram, nota: 'ativaram' },
    { rotulo: 'Abriram algum trecho', valor: funil.abriram, nota: 'chegaram ao vídeo' },
    { rotulo: 'Voltaram em outro dia', valor: funil.voltaram, nota: 'viraram hábito' },
  ]

  const base = funil.cadastraram || 1
  const abandonaram = funil.cadastraram - funil.buscaram
  const totalRecorrencia = recorrencia.reduce((a, r) => a + r.pessoas, 0)

  return (
    <div className="mb-8 grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="size-4.5 text-primary" aria-hidden="true" />
            Funil de ativação
          </CardTitle>
          <CardDescription>
            Cadastro que não vira busca é e-mail, não é lead qualificado. Este é o corte que
            separa os dois.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {etapas.map((e) => (
            <div key={e.rotulo}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span>
                  {e.rotulo}{' '}
                  <span className="text-xs text-muted-foreground">({e.nota})</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <strong className="text-base">{e.valor}</strong>
                  <span className="ml-2 text-muted-foreground">{pct(e.valor, base)}%</span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="presentation">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.max(2, pct(e.valor, base))}%` }}
                />
              </div>
            </div>
          ))}

          {abandonaram > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-muted-foreground">
                <strong className="text-foreground">
                  {abandonaram} {abandonaram === 1 ? 'pessoa' : 'pessoas'}
                </strong>{' '}
                se cadastraram e nunca buscaram. Elas não recebem a régua de nutrição, porque o
                gatilho depende de uma dor real.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Repeat className="size-4.5 text-primary" aria-hidden="true" />
              Recorrência
            </CardTitle>
            <CardDescription>Em quantos dias distintos cada pessoa buscou.</CardDescription>
          </CardHeader>
          <CardContent>
            {totalRecorrencia === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguém buscou ainda.</p>
            ) : (
              <ul className="space-y-2">
                {recorrencia.map((r) => (
                  <li key={r.dias_ativos} className="flex items-center gap-3 text-sm">
                    <span className="w-16 shrink-0 text-muted-foreground">
                      {r.dias_ativos >= 5 ? '5+ dias' : `${r.dias_ativos} dia${r.dias_ativos > 1 ? 's' : ''}`}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(4, pct(r.pessoas, totalRecorrencia))}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right tabular-nums">{r.pessoas}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Intensidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Buscas por pessoa</span>
              <strong className="tabular-nums">{qualidade.buscas_por_pessoa ?? 0}</strong>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Trechos recomendados</span>
              <strong className="tabular-nums">{qualidade.recomendacoes}</strong>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Trechos abertos</span>
              <span className="tabular-nums">
                <strong>{qualidade.aberturas}</strong>
                <Badge variant="secondary" className="ml-2 tabular-nums">
                  {pct(qualidade.aberturas, qualidade.recomendacoes)}%
                </Badge>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
