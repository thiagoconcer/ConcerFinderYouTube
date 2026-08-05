/** Helpers de HTTP compartilhados pelas Edge Functions do ConcerFinder. */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Erro previsível, com mensagem já pronta para a UI em pt-BR. */
export class AppError extends Error {
  status: number
  code: string
  constructor(message: string, status = 400, code = 'bad_request') {
    super(message)
    this.status = status
    this.code = code
  }
}

/** Secret ausente vira 503 com instrução clara de onde configurar. */
export function requireSecret(name: string): string {
  const value = Deno.env.get(name)
  if (!value) {
    throw new AppError(
      `A chave ${name} não está configurada. Defina em Supabase → Edge Functions → Secrets.`,
      503,
      'missing_secret',
    )
  }
  return value
}

export function optionalSecret(name: string): string | undefined {
  return Deno.env.get(name) || undefined
}

/** Envelope padrão: trata OPTIONS, erros previsíveis e erros inesperados. */
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }
    try {
      return await fn(req)
    } catch (error) {
      if (error instanceof AppError) {
        return json({ error: error.message, code: error.code }, error.status)
      }
      console.error('erro inesperado:', error)
      return json(
        {
          error: 'Não foi possível concluir a operação. Tente novamente em instantes.',
          code: 'internal_error',
          detail: error instanceof Error ? error.message : String(error),
        },
        500,
      )
    }
  }
}

/** fetch com timeout e mensagem de erro legível, usado nas APIs externas. */
export async function fetchJson(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  contexto = 'serviço externo',
): Promise<any> {
  const { timeoutMs = 60_000, ...rest } = init
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...rest, signal: ctrl.signal })
    const text = await res.text()
    if (!res.ok) {
      throw new AppError(
        `Falha ao chamar ${contexto} (HTTP ${res.status}): ${text.slice(0, 300)}`,
        502,
        'upstream_error',
      )
    }
    return text ? JSON.parse(text) : null
  } catch (error) {
    if (error instanceof AppError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AppError(`Tempo esgotado ao chamar ${contexto}.`, 504, 'upstream_timeout')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
