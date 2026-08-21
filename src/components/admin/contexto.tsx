import { MessageCircleQuestion } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/lib/routes'
import { formatDateTime } from '@/lib/format'
import { larguraDaFatia } from '@/lib/grafico'
import { COMMERCIAL_ROLE_LABELS } from '@/types/database'
import type { CommercialRole } from '@/types/database'
import type { ContextoInsights } from '@/types/search'

const pct = (parte: number, todo: number) => (todo === 0 ? 0 : Math.round((parte / todo) * 100))

/**
 * A pergunta de contexto: depois dos trechos, o sistema pergunta a única coisa
 * que faltava para o plano ser do caso dela, e a resposta reescreve o plano.
 *
 * A leitura tem uma ordem. Primeiro quantos respondem: taxa baixa não condena a
 * ideia, condena a pergunta, que está genérica ou no lugar errado da tela.
 * Depois o efeito, que é trechos abertos por busca com e sem contexto: quem
 * achou o plano útil vai assistir o vídeo que ele citou. Esse segundo número é
 * sinal, não prova, porque quem responde já é mais engajado do que quem ignora,
 * e a tela diz isso em vez de deixar a equipe concluir sozinha.
 *
 * A lista de perguntas e respostas fecha a seção porque ela é leitura
 * editorial: mostra a ambiguidade por trás da dor, um nível mais fino do que
 * "as pessoas perguntam sobre objeção de preço".
 */
export function Contexto({ dados }: { dados: ContextoInsights | null }) {
  const funil = dados?.funil
  const comPergunta = funil?.com_pergunta ?? 0
  const responderam = funil?.responderam ?? 0
  const perfis = dados?.por_perfil ?? []
  const ultimas = dados?.ultimas ?? []
  const ignoradas = dados?.ignoradas ?? []

  const com = dados?.efeito.com_contexto
  const sem = dados?.efeito.sem_contexto

  if (comPergunta === 0) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircleQuestion className="size-4.5 text-primary" aria-hidden="true" />
            Contexto da dor
          </CardTitle>
          <CardDescription>
            Nenhuma busca recebeu a pergunta de contexto no período. Ela entra nas buscas
            novas, e só quando a dor deixa margem para perguntar.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="mb-8 grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircleQuestion className="size-4.5 text-primary" aria-hidden="true" />
            Contexto da dor
          </CardTitle>
          <CardDescription>
            De quem recebeu a pergunta antes do plano, quantos responderam em vez de
            seguir para o plano genérico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div>
              <p className="text-3xl font-semibold tabular-nums">
                {pct(responderam, comPergunta)}%
              </p>
              <p className="text-xs text-muted-foreground">responderam</p>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{responderam}</strong> de{' '}
              <strong className="text-foreground">{comPergunta}</strong> buscas com pergunta,
              em <strong className="text-foreground">{funil?.buscas ?? 0}</strong> busca(s) no
              período. <strong className="text-foreground">{funil?.planos_refinados ?? 0}</strong>{' '}
              plano(s) nasceram com o contexto.
            </p>
          </div>

          <ul className="space-y-3">
            {perfis.map((p) => (
              <li key={p.perfil}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    {COMMERCIAL_ROLE_LABELS[p.perfil as CommercialRole] ?? p.perfil}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {p.responderam} de {p.com_pergunta} ({pct(p.responderam, p.com_pergunta)}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: larguraDaFatia(p.responderam, p.com_pergunta) }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t pt-4">
            <p className="mb-3 text-sm font-medium">Trechos abertos por busca</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-semibold tabular-nums">
                  {com?.aberturas_por_busca ?? '--'}
                </p>
                <p className="text-xs text-muted-foreground">
                  plano com contexto ({com?.buscas ?? 0} buscas)
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums text-muted-foreground">
                  {sem?.aberturas_por_busca ?? '--'}
                </p>
                <p className="text-xs text-muted-foreground">
                  plano sem contexto ({sem?.buscas ?? 0} buscas)
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Sinal, não prova: quem responde a pergunta já chega mais engajado do que quem
              ignora, então parte da diferença é dessa seleção e não do plano.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">O que estava faltando</CardTitle>
          <CardDescription>
            A pergunta que o sistema fez e o que a pessoa respondeu. Pauta de conteúdo com um
            nível a mais de precisão que o tema da dor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {ultimas.map((u) => (
              <li key={u.busca_id} className="border-b pb-4 last:border-0 last:pb-0">
                <Link
                  to={ROUTES.adminLeadPerfil(u.profile_id)}
                  className="text-sm font-medium hover:underline"
                >
                  “{u.dor}”
                </Link>
                <p className="mt-1.5 text-sm text-muted-foreground">{u.pergunta}</p>
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">Respondeu:</span> {u.resposta}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {COMMERCIAL_ROLE_LABELS[u.perfil as CommercialRole] ?? u.perfil}
                  {u.respondida_em ? ` · ${formatDateTime(u.respondida_em)}` : ''}
                </p>
              </li>
            ))}
          </ul>

          {ignoradas.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <p className="mb-2 text-sm font-medium">Perguntas que ninguém respondeu</p>
              <ul className="space-y-2">
                {ignoradas.map((g) => (
                  <li key={`${g.dor}-${g.buscado_em}`} className="text-sm text-muted-foreground">
                    <span className="text-foreground">{g.pergunta}</span>
                    <span className="block text-xs">para a dor “{g.dor}”</span>
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
