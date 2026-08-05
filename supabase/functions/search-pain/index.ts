import { AppError, handler, json } from '../_shared/http.ts'
import { requireUser, userClient } from '../_shared/supabase.ts'
import { embedText } from '../_shared/ai.ts'
import { detectTopics } from '../_shared/topics.ts'

/**
 * search-pain
 * Recebe a dor em linguagem natural, gera o embedding da consulta e chama a
 * RPC `search_videos`, devolvendo os trechos com a minutagem exata.
 *
 * Por que existe: a chave da OpenAI não pode ir para o navegador, então o
 * embedding da consulta precisa ser gerado no servidor. O SKILL.md já previa
 * uma Edge Function com este nome no fluxo de busca. Registrada no DE-PARA.
 *
 * A RPC é chamada com o JWT do próprio usuário (não com service_role), para
 * que `auth.uid()` seja o dele e a busca fique gravada no perfil certo.
 */

interface Body {
  query_text?: string
  match_count?: number
}

Deno.serve(handler(async (req) => {
  await requireUser(req)

  const body: Body = await req.json().catch(() => ({}))
  const queryText = (body.query_text ?? '').trim()

  if (queryText.length < 10) {
    throw new AppError(
      'Descreva sua dor com um pouco mais de detalhe (mínimo de 10 caracteres).',
      400,
      'query_too_short',
    )
  }
  if (queryText.length > 2000) {
    throw new AppError('Sua descrição passou de 2000 caracteres. Resuma um pouco.', 400, 'query_too_long')
  }

  const matchCount = Math.min(Math.max(body.match_count ?? 6, 1), 20)

  // 1. embedding da dor descrita
  const embedding = await embedText(queryText)

  // 2. temas detectados, alimentam a segmentação de audiência
  const topicos = detectTopics(queryText)

  // 3. busca vetorial + persistência de searches/search_results
  const db = userClient(req)
  const { data, error } = await db.rpc('search_videos', {
    query_embedding: embedding,
    match_count: matchCount,
    query_text: queryText,
    detected_topics: topicos.length > 0 ? topicos : null,
  })

  if (error) {
    if (error.code === '42501') {
      throw new AppError('É preciso estar autenticado para buscar insights.', 401, 'unauthenticated')
    }
    throw new AppError(`Falha na busca: ${error.message}`, 500, 'search_failed')
  }

  const resultados = (data ?? []) as Array<Record<string, unknown>>

  // O search_id vem em toda linha; quando não há resultado, a busca ainda foi
  // gravada, então recuperamos o id da última busca do usuário para o plano.
  let searchId = resultados[0]?.search_id as string | undefined
  if (!searchId) {
    const { data: ultima } = await db
      .from('searches')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    searchId = ultima?.id
  }

  /*
    Agora existe dor real para contar, então o lead entra na régua: o sync
    grava os campos personalizados e aplica a tag do perfil, que é o gatilho
    da automação no ActiveCampaign. Não bloqueia a resposta da busca.
  */
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-nurture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.get('Authorization') ?? '',
      },
      body: JSON.stringify({ aplicar_gatilho: true }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    console.warn('sync-nurture falhou apos a busca:', error)
  }

  return json({
    search_id: searchId,
    query_text: queryText,
    detected_topics: topicos,
    results: resultados,
    total: resultados.length,
  })
}))
