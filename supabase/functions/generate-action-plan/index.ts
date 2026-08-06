import { AppError, handler, json } from '../_shared/http.ts'
import { isCronCall, isServiceRoleCall, requireUser, serviceClient } from '../_shared/supabase.ts'
import { generateActionPlan, type PlanSegment } from '../_shared/ai.ts'

/**
 * generate-action-plan
 * Monta o plano de ação a partir da dor descrita e dos top segmentos
 * recuperados na busca. Grava em `searches.action_plan` com service_role.
 *
 * Dois modos:
 *  - usuário logado: gera o plano da própria busca, idempotente (se já
 *    existe, devolve o gravado sem pagar outra chamada de LLM);
 *  - interno (X-Cron-Secret ou service_role): pode regerar o plano de
 *    QUALQUER busca com `force`, e monta os trechos a partir do que ficou
 *    persistido em search_results. É o que permite reprocessar os planos
 *    antigos depois de mudar o prompt, sem impersonar o usuário dono.
 */

interface Body {
  search_id?: string
  query_text?: string
  top_segments?: PlanSegment[]
  force?: boolean
}

Deno.serve(handler(async (req) => {
  const interno = isCronCall(req) || isServiceRoleCall(req)
  const user = interno ? null : await requireUser(req)

  const body: Body = await req.json().catch(() => ({}))

  if (!body.search_id) {
    throw new AppError('search_id é obrigatório.', 400, 'missing_search_id')
  }

  const db = serviceClient()

  const { data: busca, error } = await db
    .from('searches')
    .select('id, profile_id, query_text, action_plan, profiles(commercial_role)')
    .eq('id', body.search_id)
    .maybeSingle()

  if (error) throw new AppError(`Falha ao carregar a busca: ${error.message}`, 500)
  if (!busca) throw new AppError('Busca não encontrada.', 404, 'search_not_found')

  // A busca precisa ser do próprio usuário: impede gerar/gravar plano
  // no registro de outra pessoa. Chamada interna não passa por aqui.
  if (user && busca.profile_id !== user.id) {
    throw new AppError('Esta busca não pertence a você.', 403, 'forbidden')
  }

  // Idempotência: se o plano já foi gerado, devolve o que está gravado em
  // vez de pagar outra chamada de LLM. `force` (só no modo interno) ignora.
  const regerar = interno && body.force === true
  if (busca.action_plan && !regerar) {
    return json({ search_id: busca.id, action_plan: busca.action_plan, cached: true })
  }

  let segmentos = (body.top_segments ?? []).filter(
    (s) => typeof s?.segment_text === 'string' && s.segment_text.trim().length > 0,
  )

  // Sem trechos no corpo (caso do reprocessamento), remonta a partir do que
  // ficou persistido, na mesma ordem de ranking usada na geração original.
  if (segmentos.length === 0) {
    const { data: linhas } = await db
      .from('search_results')
      .select('rank_position, start_seconds, videos(title), video_segments(segment_text)')
      .eq('search_id', busca.id)
      .order('rank_position')

    segmentos = (linhas ?? [])
      .map((l: Record<string, any>) => ({
        title: l.videos?.title as string | undefined,
        segment_text: (l.video_segments?.segment_text ?? '') as string,
        start_seconds: l.start_seconds as number,
      }))
      .filter((s) => s.segment_text.trim().length > 0)
  }

  const perfil = (busca as Record<string, any>).profiles?.commercial_role as string | undefined

  const plano = await generateActionPlan(
    body.query_text?.trim() || busca.query_text,
    segmentos.slice(0, 8),
    perfil,
  )

  // Trava de concorrência: duas gerações simultâneas (duplo clique, duas
  // abas) pagariam o LLM duas vezes e a última venceria. Fora do modo force,
  // só grava se ainda não há plano; se outra chamada chegou antes, devolve o
  // que ela gravou.
  let query = db.from('searches').update({ action_plan: plano }).eq('id', busca.id)
  if (!regerar) query = query.is('action_plan', null)
  const { data: gravadas, error: upErr } = await query.select('id')

  if (upErr) throw new AppError(`Falha ao gravar o plano: ${upErr.message}`, 500)

  if (!regerar && (gravadas ?? []).length === 0) {
    const { data: existente } = await db
      .from('searches')
      .select('action_plan')
      .eq('id', busca.id)
      .maybeSingle()
    return json({ search_id: busca.id, action_plan: existente?.action_plan ?? plano, cached: true })
  }

  return json({ search_id: busca.id, action_plan: plano, cached: false, regenerated: regerar })
}))
