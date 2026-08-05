import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, History, Loader2, Search, Sparkles } from 'lucide-react'
import { ActionPlan } from '@/components/action-plan'
import { ResultCard } from '@/components/result-card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { ROUTES } from '@/lib/routes'
import { topicLabel } from '@/lib/format'
import type { ActionPlanResponse, SearchHit, SearchPainResponse } from '@/types/search'

const SUGESTOES = [
  'Meu time não consegue contornar a objeção de preço',
  'Não sei estruturar meu processo de prospecção',
  'O cliente some depois que eu mando a proposta',
  'Meus vendedores não fazem follow-up',
  'Preciso montar uma meta que o time realmente compre',
  'Minha equipe está desmotivada e não bate meta',
]

type Estado =
  | { fase: 'inicial' }
  | { fase: 'buscando' }
  | { fase: 'pronto'; busca: SearchPainResponse; plano: string | null; gerandoPlano: boolean }
  | { fase: 'erro'; mensagem: string }

/** Mensagem de erro da Edge Function, que vem no corpo mesmo em status != 2xx. */
async function mensagemDeErro(error: unknown, fallback: string): Promise<string> {
  const contexto = (error as { context?: Response })?.context
  if (contexto && typeof contexto.json === 'function') {
    try {
      const corpo = await contexto.json()
      if (corpo?.error) return String(corpo.error)
    } catch {
      // corpo não era JSON, cai no fallback
    }
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function BuscaPage() {
  const [params] = useSearchParams()
  const [texto, setTexto] = useState(params.get('q') ?? '')
  const [estado, setEstado] = useState<Estado>({ fase: 'inicial' })

  async function gerarPlano(searchId: string, queryText: string, resultados: SearchHit[]) {
    try {
      const { data, error } = await supabase.functions.invoke<ActionPlanResponse>(
        'generate-action-plan',
        {
          body: {
            search_id: searchId,
            query_text: queryText,
            top_segments: resultados.slice(0, 8).map((r) => ({
              title: r.title,
              segment_text: r.segment_text,
              start_seconds: r.start_seconds,
            })),
          },
        },
      )
      if (error) throw error

      setEstado((atual) =>
        atual.fase === 'pronto'
          ? { ...atual, plano: data?.action_plan ?? null, gerandoPlano: false }
          : atual,
      )
    } catch (error) {
      const mensagem = await mensagemDeErro(error, 'Não foi possível gerar o plano de ação.')
      setEstado((atual) =>
        atual.fase === 'pronto' ? { ...atual, plano: `_erro_:${mensagem}`, gerandoPlano: false } : atual,
      )
    }
  }

  const buscar = useCallback(async function buscar(consulta: string) {
    const query = consulta.trim()
    if (query.length < 10) {
      setEstado({
        fase: 'erro',
        mensagem: 'Descreva sua dor com um pouco mais de detalhe (mínimo de 10 caracteres).',
      })
      return
    }

    setEstado({ fase: 'buscando' })
    try {
      const { data, error } = await supabase.functions.invoke<SearchPainResponse>('search-pain', {
        body: { query_text: query },
      })
      if (error) throw error
      if (!data) throw new Error('Resposta vazia da busca.')

      setEstado({ fase: 'pronto', busca: data, plano: null, gerandoPlano: true })

      if (data.search_id) {
        void gerarPlano(data.search_id, data.query_text, data.results)
      } else {
        setEstado((atual) => (atual.fase === 'pronto' ? { ...atual, gerandoPlano: false } : atual))
      }
    } catch (error) {
      setEstado({
        fase: 'erro',
        mensagem: await mensagemDeErro(error, 'Não foi possível processar sua busca.'),
      })
    }
    // gerarPlano só usa setState, não precisa entrar nas dependências
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // "Repetir busca" no histórico chega como /busca?q=...
  const jaRodouDaUrl = useRef(false)
  useEffect(() => {
    const q = params.get('q')
    if (q && !jaRodouDaUrl.current) {
      jaRodouDaUrl.current = true
      void buscar(q)
    }
  }, [params, buscar])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void buscar(texto)
  }

  const carregando = estado.fase === 'buscando'

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="mb-8">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Qual é a sua dor de vendas?
        </h1>
        <p className="mt-3 text-muted-foreground">
          Escreva com as suas palavras, como você contaria para um colega. A busca é por
          significado, não por palavra-chave.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          disabled={carregando}
          rows={4}
          maxLength={2000}
          placeholder="Ex.: meu time trava quando o cliente fala que está caro e acaba dando desconto sem necessidade"
          className="w-full resize-y rounded-lg border bg-transparent px-4 py-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
          aria-label="Descreva sua dor de vendas"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={carregando}>
            {carregando ? <Loader2 className="animate-spin" /> : <Search />}
            {carregando ? 'Analisando...' : 'Buscar insights'}
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link to={ROUTES.historico}>
              <History />
              Minhas buscas
            </Link>
          </Button>
        </div>
      </form>

      {/* Sugestões: aparecem antes da primeira busca */}
      {estado.fase === 'inicial' && (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-muted-foreground">
            Não sabe como descrever? Comece por uma destas:
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {SUGESTOES.map((sugestao) => (
              <li key={sugestao}>
                <button
                  type="button"
                  onClick={() => {
                    setTexto(sugestao)
                    void buscar(sugestao)
                  }}
                  className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {sugestao}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Carregando */}
      {carregando && (
        <section className="mt-10 space-y-4" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Analisando sua dor e localizando os melhores trechos...
          </p>
          <Skeleton className="h-40 w-full" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </section>
      )}

      {/* Erro */}
      {estado.fase === 'erro' && (
        <Alert variant="destructive" className="mt-10">
          <AlertCircle />
          <AlertTitle>Não foi possível processar sua busca</AlertTitle>
          <AlertDescription>
            {estado.mensagem}
            <Button variant="outline" size="sm" onClick={() => void buscar(texto)}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Resultados */}
      {estado.fase === 'pronto' && (
        <section className="mt-10 space-y-8">
          {estado.busca.detected_topics.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Temas identificados:</span>
              {estado.busca.detected_topics.map((topico) => (
                <Badge key={topico} variant="secondary">
                  {topicLabel(topico)}
                </Badge>
              ))}
            </div>
          )}

          {/* Plano de ação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="size-5 text-muted-foreground" />
                Seu plano de ação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {estado.gerandoPlano ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <p className="pt-2 text-sm text-muted-foreground">
                    Consolidando os insights dos trechos encontrados...
                  </p>
                </div>
              ) : estado.plano?.startsWith('_erro_:') ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>O plano de ação não pôde ser gerado</AlertTitle>
                  <AlertDescription>
                    {estado.plano.replace('_erro_:', '')}
                    <span className="text-muted-foreground">
                      As recomendações abaixo continuam válidas.
                    </span>
                  </AlertDescription>
                </Alert>
              ) : estado.plano ? (
                <ActionPlan markdown={estado.plano} />
              ) : (
                <p className="text-sm text-muted-foreground">Plano de ação indisponível.</p>
              )}
            </CardContent>
          </Card>

          {/* Recomendações */}
          {estado.busca.results.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                {estado.busca.total} {estado.busca.total === 1 ? 'trecho' : 'trechos'} para assistir
              </h2>
              {estado.busca.results.map((hit) => (
                <ResultCard key={hit.segment_id} hit={hit} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="font-medium">
                  Não encontramos trechos suficientemente relevantes para essa dor
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Tente reformular com mais contexto do seu dia a dia. A busca é por significado,
                  então descrever a situação real funciona melhor do que uma palavra solta.
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      )}
    </div>
  )
}
