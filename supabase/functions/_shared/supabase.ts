import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { AppError } from './http.ts'

/**
 * Cliente com service_role: escreve em leads, videos, video_segments,
 * search_results e ingestion_runs. A chave é injetada pelo próprio
 * Supabase no runtime da Edge Function e nunca sai daqui.
 */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/** Cliente que age COMO o usuário chamador, respeitando a RLS. */
export function userClient(req: Request): SupabaseClient {
  const authorization = req.headers.get('Authorization') ?? ''
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

export interface CallerUser {
  id: string
  email?: string
}

/** Exige um JWT de usuário válido. Usado pelas funções do fluxo logado. */
export async function requireUser(req: Request): Promise<CallerUser> {
  const authorization = req.headers.get('Authorization')
  if (!authorization) {
    throw new AppError('É preciso estar autenticado.', 401, 'unauthenticated')
  }
  const { data, error } = await serviceClient().auth.getUser(
    authorization.replace('Bearer ', ''),
  )
  if (error || !data.user) {
    throw new AppError('Sessão inválida ou expirada. Entre novamente.', 401, 'unauthenticated')
  }
  return { id: data.user.id, email: data.user.email ?? undefined }
}

/** Comparação em tempo constante, não vaza informação pelo tempo de resposta. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** true quando a chamada veio com a própria service_role (interno). */
export function isServiceRoleCall(req: Request): boolean {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return Boolean(token) && Boolean(service) && timingSafeEqual(token, service)
}

/**
 * true quando a chamada veio do pg_cron.
 * O cron usa um segredo dedicado (CRON_SECRET) em vez da service_role: se
 * vazar, abre só estas três rotas de ingestão, não o banco inteiro.
 */
export function isCronCall(req: Request): boolean {
  const enviado = req.headers.get('x-cron-secret') ?? ''
  const esperado = Deno.env.get('CRON_SECRET') ?? ''
  return Boolean(enviado) && Boolean(esperado) && timingSafeEqual(enviado, esperado)
}

/** Exige staff Concer (content_admin ou audience_manager), cron ou chamada interna. */
export async function requireStaffOrService(req: Request): Promise<CallerUser | null> {
  if (isCronCall(req) || isServiceRoleCall(req)) return null

  const user = await requireUser(req)
  const { data, error } = await serviceClient()
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data || !['content_admin', 'audience_manager'].includes(data.role)) {
    throw new AppError('Acesso restrito à equipe Concer.', 403, 'forbidden')
  }
  return user
}

// ------------------------------------------------------------------
// ingestion_runs: log de cada execução da esteira
// ------------------------------------------------------------------
export type RunType = 'scrape' | 'transcribe' | 'index'

export async function startRun(db: SupabaseClient, runType: RunType): Promise<string> {
  const { data, error } = await db
    .from('ingestion_runs')
    .insert({ run_type: runType, status: 'running' })
    .select('id')
    .single()
  if (error) throw new AppError(`Não foi possível abrir a execução: ${error.message}`, 500)
  return data.id
}

export async function finishRun(
  db: SupabaseClient,
  runId: string,
  patch: { status: 'completed' | 'failed'; videos_processed?: number; error_message?: string },
): Promise<void> {
  await db
    .from('ingestion_runs')
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq('id', runId)
}
