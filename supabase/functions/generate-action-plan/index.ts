import { AppError, handler, json } from '../_shared/http.ts'
import { requireUser, serviceClient } from '../_shared/supabase.ts'
import { generateActionPlan, type PlanSegment } from '../_shared/ai.ts'

/**
 * generate-action-plan
 * Monta o plano de ação a partir da dor descrita e dos top segmentos
 * recuperados na busca. Grava em `searches.action_plan` com service_role.
 */

interface Body {
  search_id?: string
  query_text?: string
  top_segments?: PlanSegment[]
}

Deno.serve(handler(async (req) => {
  const user = await requireUser(req)
  const body: Body = await req.json().catch(() => ({}))

  if (!body.search_id) {
    throw new AppError('search_id é obrigatório.', 400, 'missing_search_id')
  }

  const db = serviceClient()

  // A busca precisa ser do próprio usuário: impede gerar/gravar plano
  // no registro de outra pessoa.
  const { data: busca, error } = await db
    .from('searches')
    .select('id, profile_id, query_text, action_plan')
    .eq('id', body.search_id)
    .maybeSingle()

  if (error) throw new AppError(`Falha ao carregar a busca: ${error.message}`, 500)
  if (!busca) throw new AppError('Busca não encontrada.', 404, 'search_not_found')
  if (busca.profile_id !== user.id) {
    throw new AppError('Esta busca não pertence a você.', 403, 'forbidden')
  }

  // Idempotência: se o plano já foi gerado, devolve o que está gravado
  // em vez de pagar outra chamada de LLM.
  if (busca.action_plan) {
    return json({ search_id: busca.id, action_plan: busca.action_plan, cached: true })
  }

  const segmentos = (body.top_segments ?? []).filter(
    (s) => typeof s?.segment_text === 'string' && s.segment_text.trim().length > 0,
  )

  const plano = await generateActionPlan(
    body.query_text?.trim() || busca.query_text,
    segmentos.slice(0, 8),
  )

  const { error: upErr } = await db
    .from('searches')
    .update({ action_plan: plano })
    .eq('id', busca.id)

  if (upErr) throw new AppError(`Falha ao gravar o plano: ${upErr.message}`, 500)

  return json({ search_id: busca.id, action_plan: plano, cached: false })
}))
