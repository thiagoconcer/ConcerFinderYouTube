import { AppError, handler, json } from '../_shared/http.ts'
import { requireUser, serviceClient } from '../_shared/supabase.ts'
import { generateContextQuestion, type PlanSegment } from '../_shared/ai.ts'

/**
 * context-question
 * Gera a pergunta que refina o plano de ação, a partir da dor descrita e dos
 * trechos que a busca acabou de devolver. Grava em `searches.context_question`.
 *
 * POR QUE É UMA FUNÇÃO SEPARADA, e não um pedaço do search-pain: a busca é o
 * momento em que a pessoa está olhando a tela esperando os trechos, e somar
 * mais uma chamada de LLM ali atrasaria a entrega para todo mundo, inclusive
 * para quem nunca vai responder a pergunta. Aqui o frontend dispara esta função
 * EM PARALELO com generate-action-plan, depois que os trechos já apareceram.
 *
 * A pergunta é opcional por natureza: quando o modelo acha que não falta nada
 * (dor já detalhada) ou quando a chamada falha, devolve `question: null` e a
 * tela simplesmente não mostra a caixa. Nada aqui pode segurar o plano.
 */

interface Body {
  search_id?: string
  top_segments?: PlanSegment[]
}

Deno.serve(handler(async (req) => {
  const user = await requireUser(req)

  const body: Body = await req.json().catch(() => ({}))
  if (!body.search_id) {
    throw new AppError('search_id é obrigatório.', 400, 'missing_search_id')
  }

  const db = serviceClient()

  const { data: busca, error } = await db
    .from('searches')
    .select(
      'id, profile_id, query_text, context_question, context_options, context_answer, profiles(commercial_role)',
    )
    .eq('id', body.search_id)
    .maybeSingle()

  if (error) throw new AppError(`Falha ao carregar a busca: ${error.message}`, 500)
  if (!busca) throw new AppError('Busca não encontrada.', 404, 'search_not_found')

  if (busca.profile_id !== user.id) {
    throw new AppError('Esta busca não pertence a você.', 403, 'forbidden')
  }

  // Idempotência: a pergunta de uma busca é gerada uma vez. Recarregar a tela
  // ou voltar de um vídeo não pode pagar outra chamada nem trocar a pergunta
  // debaixo de quem já estava respondendo.
  if (busca.context_question) {
    return json({
      search_id: busca.id,
      question: busca.context_question,
      options: busca.context_options ?? [],
      answered: Boolean(busca.context_answer),
      cached: true,
    })
  }

  const segmentos = (body.top_segments ?? []).filter(
    (s) => typeof s?.segment_text === 'string' && s.segment_text.trim().length > 0,
  )

  const perfil = (busca as Record<string, any>).profiles?.commercial_role as string | undefined

  const pergunta = await generateContextQuestion(busca.query_text, segmentos.slice(0, 5), perfil)

  if (!pergunta) {
    return json({ search_id: busca.id, question: null, options: [], answered: false })
  }

  const { error: upErr } = await db
    .from('searches')
    .update({ context_question: pergunta.pergunta, context_options: pergunta.opcoes })
    .eq('id', busca.id)
    // Se duas abas chegaram juntas, a primeira grava e a segunda não sobrescreve.
    .is('context_question', null)

  if (upErr) throw new AppError(`Falha ao gravar a pergunta: ${upErr.message}`, 500)

  return json({
    search_id: busca.id,
    question: pergunta.pergunta,
    options: pergunta.opcoes,
    answered: false,
  })
}))
