import { BriefcaseBusiness } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { topicLabel } from '@/lib/format'
import { CARGO_LABELS, COMMERCIAL_ROLE_LABELS } from '@/types/database'
import type { Cargo, CommercialRole } from '@/types/database'
import type { CargoInsights } from '@/types/search'

/**
 * 'diretor' -> 'Diretor (a)'.
 *
 * O grupo sem cargo não pode sumir do gráfico, senão os totais deixam de
 * fechar. Mas ele não é falta de preenchimento: são cadastros feitos antes de
 * o campo existir, e dizer isso evita que alguém vá cobrar um dado que a
 * pessoa nunca teve como informar. O grupo encolhe sozinho conforme entram
 * cadastros novos.
 */
function rotuloCargo(cargo: string): string {
  if (cargo === 'nao_informado') return 'Cadastro antes do campo cargo'
  return CARGO_LABELS[cargo as Cargo] ?? cargo
}

/**
 * O cadastro pergunta o cargo (9 opções) e a régua de nutrição roda em 3
 * perfis. Este painel mostra a granularidade fina, que é a que interessa para
 * conversar com um parceiro: "temos N diretores comerciais procurando
 * previsibilidade" vende melhor do que "temos N gestores".
 */
export function Cargos({ dados }: { dados: CargoInsights | null }) {
  const pessoas = dados?.pessoas_por_cargo ?? []
  const temas = dados?.temas_por_cargo ?? []
  const totalPessoas = pessoas.reduce((acc, p) => acc + p.total, 0)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BriefcaseBusiness className="size-4.5 text-primary" aria-hidden="true" />
            Cadastros por cargo
          </CardTitle>
          <CardDescription>
            A hierarquia real de quem procura o ConcerFinder, e a régua que cada cargo recebe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pessoas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cadastro ainda.</p>
          ) : (
            <ul className="space-y-3">
              {pessoas.map((p) => (
                <li key={p.cargo}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{rotuloCargo(p.cargo)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{p.total}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.max(6, (p.total / Math.max(totalPessoas, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs font-normal">
                      {COMMERCIAL_ROLE_LABELS[p.commercial_role as CommercialRole] ??
                        p.commercial_role}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">O que cada cargo procura</CardTitle>
          <CardDescription>
            Os temas mais buscados, agora no nível do cargo e não só do perfil.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {temas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem buscas suficientes ainda.</p>
          ) : (
            <div className="space-y-5">
              {temas.map((c) => (
                <div key={c.cargo}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold">{rotuloCargo(c.cargo)}</h4>
                    <Badge variant="secondary" className="tabular-nums">
                      {c.total} {c.total === 1 ? 'busca' : 'buscas'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.temas.slice(0, 6).map((t) => (
                      <Badge key={t.topico} variant="outline" className="font-normal">
                        {topicLabel(t.topico)}
                        <span className="ml-1.5 tabular-nums text-muted-foreground">{t.total}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
