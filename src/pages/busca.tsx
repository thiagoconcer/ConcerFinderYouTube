import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, History, Loader2, Search, Sparkles } from 'lucide-react'
import { ActionPlan } from '@/components/action-plan'
import { ContextoDaDor } from '@/components/contexto-da-dor'
import { ResultCard } from '@/components/result-card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { ROUTES } from '@/lib/routes'
import { topicLabel } from '@/lib/format'
import type {
  ActionPlanResponse,
  ContextQuestionResponse,
  SearchHit,
  SearchPainResponse,
} from '@/types/search'

const SUGESTOES = [
  'Meu time não consegue contornar a objeção de preço',
  'Não sei estruturar meu processo de prospecção',
  'O cliente some depois que eu mando a proposta',
  'Meus vendedores não fazem follow-up',
  'Preciso montar uma meta que o time realmente compre',
  'Minha equipe está desmotivada e não bate meta',
]

/**
 * A última busca sobrevive à navegação. Sem isso, "voltar aos resultados" do
 * vídeo remontava a página vazia: plano e trechos sumiam e a pessoa precisava
 * buscar de novo, gastando o próprio limite de buscas para rever o que já
 * tinha. sessionStorage, não localStorage: morre com a aba, que é o escopo
 * certo para "a sessão de estudo de agora".
 */
const CACHE_BUSCA = 'concerfinder-ultima-busca'

/**
 * Cadastro que falhou no register-lead deixa este marcador; a página de busca
 * tenta de novo. Sem isso, uma falha de rede no submit fazia o lead nunca
 * existir e ninguém reprocessava.
 */
const LEAD_PENDENTE = 'concerfinder-lead-pendente'

/**
 * O contexto tem vida própria dentro do estado "pronto": a pergunta chega
 * depois dos trechos (outra chamada, em paralelo com o plano) e a resposta
 * reescreve o plano sem refazer a busca.
 */
interface Contexto {
  pergunta: string
  opcoes: string[]
  /** 'aberta' enquanto ela pode responder; some quando responde ou dispensa. */
  situacao: 'aberta' | 'enviando' | 'respondida' | 'dispensada'
}

type Estado =
  | { fase: 'inicial' }
  | { fase: 'buscando' }
  | {
      fase: 'pronto'
      busca: SearchPainResponse
      plano: string | null
      gerandoPlano: boolean
      contexto: Contexto | null
    }

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

function lerCache(): {
  texto: string
  busca: SearchPainResponse
  plano: string | null
  contexto?: Contexto | null
} | null {
  try {
    const bruto = sessionStorage.getItem(CACHE_BUSCA)
    if (!bruto) return null
    const dado = JSON.parse(bruto)
    if (!dado?.busca?.results) return null
    return dado
  } catch {
    return null
  }
}

export function BuscaPage() {
  const [params] = useSearchParams()
  const [texto, setTexto] = useState(params.get('q') ?? '')
  const [estado, setEstado] = useState<Estado>({ fase: 'inicial' })
  const [erro, setErro] = useState<string | null>(null)

  // Guarda o último resultado bom: se uma busca nova falhar, a tela volta
  // para ele em vez de jogar fora o que a pessoa ainda estava lendo.
  const ultimoPronto = useRef<Estado | null>(null)

  /**
   * Pede a pergunta de contexto. Roda em paralelo com o plano, e falha em
   * silêncio de propósito: a pergunta é um bônus, e um erro dela não pode virar
   * alerta vermelho na tela de quem acabou de receber os trechos.
   */
  async function pedirPergunta(searchId: string, resultados: SearchHit[]) {
    try {
      const { data, error } = await supabase.functions.invoke<ContextQuestionResponse>(
        'context-question',
        {
          body: {
            search_id: searchId,
            top_segments: resultados.slice(0, 5).map((r) => ({
              title: r.title,
              segment_text: r.segment_text,
              start_seconds: r.start_seconds,
            })),
          },
        },
      )
      if (error || !data?.question || data.answered) return

      setEstado((atual) =>
        atual.fase === 'pronto' && atual.busca.search_id === searchId && !atual.contexto
          ? {
              ...atual,
              contexto: {
                pergunta: data.question as string,
                opcoes: data.options ?? [],
                situacao: 'aberta',
              },
            }
          : atual,
      )
    } catch {
      // sem pergunta, a tela segue igual ao que era antes dela existir
    }
  }

  async function gerarPlano(
    searchId: string,
    queryText: string,
    resultados: SearchHit[],
    contextoResposta?: string,
  ) {
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
              similarity_score: r.similarity_score,
            })),
            ...(contextoResposta ? { context_answer: contextoResposta } : {}),
          },
        },
      )
      if (error) throw error

      // O plano só entra na busca que o pediu. Sem comparar o id, uma segunda
      // busca disparada no meio recebia o plano da primeira, com citações
      // apontando para trechos que não estão mais na tela.
      setEstado((atual) =>
        atual.fase === 'pronto' && atual.busca.search_id === searchId
          ? {
              ...atual,
              plano: data?.action_plan ?? null,
              gerandoPlano: false,
              contexto: contextoResposta
                ? atual.contexto && { ...atual.contexto, situacao: 'respondida' }
                : atual.contexto,
            }
          : atual,
      )
    } catch (error) {
      const mensagem = await mensagemDeErro(error, 'Não foi possível gerar o plano de ação.')
      setEstado((atual) =>
        atual.fase === 'pronto' && atual.busca.search_id === searchId
          ? {
              ...atual,
              plano: `_erro_:${mensagem}`,
              gerandoPlano: false,
              // A caixa volta a ficar aberta: a resposta dela não se perdeu por
              // causa de uma falha de rede, dá para tentar de novo.
              contexto: contextoResposta
                ? atual.contexto && { ...atual.contexto, situacao: 'aberta' }
                : atual.contexto,
            }
          : atual,
      )
    }
  }

  /** Responder reescreve o plano; a busca e os trechos ficam onde estão. */
  function responderContexto(resposta: string) {
    if (estado.fase !== 'pronto' || !estado.busca.search_id) return
    const { search_id: searchId, query_text: consulta, results } = estado.busca

    setEstado((atual) =>
      atual.fase === 'pronto'
        ? {
            ...atual,
            gerandoPlano: true,
            contexto: atual.contexto && { ...atual.contexto, situacao: 'enviando' },
          }
        : atual,
    )
    void gerarPlano(searchId, consulta, results, resposta)
  }

  function dispensarContexto() {
    setEstado((atual) =>
      atual.fase === 'pronto'
        ? { ...atual, contexto: atual.contexto && { ...atual.contexto, situacao: 'dispensada' } }
        : atual,
    )
  }

  const buscar = useCallback(async function buscar(consulta: string) {
    const query = consulta.trim()
    setErro(null)

    // Erro de validação é do campo, não da tela: não pode apagar os
    // resultados que a pessoa ainda está lendo.
    if (query.length < 10) {
      setErro('Descreva sua dor com um pouco mais de detalhe (mínimo de 10 caracteres).')
      return
    }

    setEstado({ fase: 'buscando' })
    try {
      const { data, error } = await supabase.functions.invoke<SearchPainResponse>('search-pain', {
        body: { query_text: query },
      })
      if (error) throw error
      if (!data) throw new Error('Resposta vazia da busca.')

      const novo: Estado = {
        fase: 'pronto',
        busca: data,
        plano: null,
        gerandoPlano: true,
        contexto: null,
      }
      ultimoPronto.current = novo
      setEstado(novo)

      if (data.search_id) {
        // As duas em paralelo: o plano já começa com o que existe, e a pergunta
        // aparece durante a espera dele em vez de criar uma espera nova.
        void gerarPlano(data.search_id, data.query_text, data.results)
        void pedirPergunta(data.search_id, data.results)
      } else {
        setEstado((atual) => (atual.fase === 'pronto' ? { ...atual, gerandoPlano: false } : atual))
      }
    } catch (error) {
      setErro(await mensagemDeErro(error, 'Não foi possível processar sua busca.'))
      // A falha não destrói a leitura anterior
      setEstado(ultimoPronto.current ?? { fase: 'inicial' })
    }
    // gerarPlano só usa setState, não precisa entrar nas dependências
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // "Repetir busca" no histórico chega como /busca?q=...; sem q, reidrata a
  // última busca da sessão, para o "voltar" do vídeo não zerar a tela.
  const jaRodouDaUrl = useRef(false)
  useEffect(() => {
    if (jaRodouDaUrl.current) return
    jaRodouDaUrl.current = true

    const q = params.get('q')
    if (q) {
      void buscar(q)
      return
    }
    const cache = lerCache()
    if (cache) {
      setTexto(cache.texto)
      const restaurado: Estado = {
        fase: 'pronto',
        busca: cache.busca,
        plano: cache.plano,
        gerandoPlano: false,
        contexto: cache.contexto ?? null,
      }
      ultimoPronto.current = restaurado
      setEstado(restaurado)
    }
  }, [params, buscar])

  // Persiste quando o plano termina (ou falha): é o momento em que a tela
  // está completa e vale a pena voltar para ela.
  useEffect(() => {
    if (estado.fase !== 'pronto' || estado.gerandoPlano) return
    try {
      sessionStorage.setItem(
        CACHE_BUSCA,
        JSON.stringify({
          texto: estado.busca.query_text,
          busca: estado.busca,
          plano: estado.plano,
          contexto: estado.contexto,
        }),
      )
    } catch {
      // storage cheio ou bloqueado: perder o cache não pode quebrar a página
    }
  }, [estado])

  // Reprocessa um register-lead que falhou no cadastro (rede móvel, cold
  // start). A função é idempotente, então repetir é seguro.
  useEffect(() => {
    const pendente = localStorage.getItem(LEAD_PENDENTE)
    if (!pendente) return
    void (async () => {
      try {
        const { error } = await supabase.functions.invoke('register-lead', {
          body: JSON.parse(pendente),
        })
        if (!error) localStorage.removeItem(LEAD_PENDENTE)
      } catch {
        // fica para a próxima visita
      }
    })()
  }, [])

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
          aria-invalid={Boolean(erro)}
          aria-describedby={erro ? 'erro-busca' : undefined}
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

      {erro && (
        <Alert variant="destructive" className="mt-6" id="erro-busca" role="alert">
          <AlertCircle />
          <AlertTitle>Não deu para buscar</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

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
                <ActionPlan
                  markdown={estado.plano}
                  segments={estado.busca.results}
                  searchId={estado.busca.search_id}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Plano de ação indisponível.</p>
              )}
            </CardContent>
          </Card>

          {/*
            A pergunta de contexto entra entre o plano e os trechos: depois do
            que ela veio buscar, antes do que ela vai assistir. É o único ponto
            da tela em que uma pergunta não atrapalha, porque o plano já está
            entregue e os trechos continuam logo abaixo.
          */}
          {estado.contexto?.situacao === 'aberta' || estado.contexto?.situacao === 'enviando' ? (
            <ContextoDaDor
              pergunta={estado.contexto.pergunta}
              opcoes={estado.contexto.opcoes}
              enviando={estado.contexto.situacao === 'enviando'}
              onEnviar={responderContexto}
              onDispensar={dispensarContexto}
            />
          ) : estado.contexto?.situacao === 'respondida' ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-primary" />
              Plano reescrito com o contexto que você contou.
            </p>
          ) : null}

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
