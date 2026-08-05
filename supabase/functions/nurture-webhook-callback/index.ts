import { AppError, handler, json, requireSecret } from '../_shared/http.ts'
import { serviceClient } from '../_shared/supabase.ts'

/**
 * nurture-webhook-callback
 * Recebe do N8N/Make o status de entrega da régua e fecha o ciclo do lead.
 * Não usa JWT: a autenticação é HMAC-SHA256 do corpo bruto, no header
 * X-Signature, com o segredo compartilhado NURTURE_WEBHOOK_SECRET.
 *
 * Precisa de verify_jwt = false no config.toml (chamador externo).
 */

interface Body {
  lead_id?: string
  delivery_status?: string
  channel?: string
}

/** Comparação em tempo constante, evita vazar informação pelo tempo de resposta. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const assinatura = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return [...new Uint8Array(assinatura)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(handler(async (req) => {
  const secret = requireSecret('NURTURE_WEBHOOK_SECRET')

  // corpo bruto: a assinatura tem que ser conferida antes de qualquer parse
  const raw = await req.text()
  const recebida = (req.headers.get('x-signature') ?? '').replace(/^sha256=/, '').toLowerCase()
  const esperada = await hmacHex(secret, raw)

  if (!recebida || !timingSafeEqual(recebida, esperada)) {
    throw new AppError('Assinatura inválida.', 401, 'invalid_signature')
  }

  const body: Body = raw ? JSON.parse(raw) : {}
  if (!body.lead_id) {
    throw new AppError('lead_id é obrigatório.', 400, 'missing_lead_id')
  }

  const status = body.delivery_status === 'sent' ? 'sent' : 'failed'
  const db = serviceClient()

  const { data, error } = await db
    .from('leads')
    .update({
      nurture_status: status,
      nurture_sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
    .eq('id', body.lead_id)
    .select('id')
    .maybeSingle()

  if (error) throw new AppError(`Falha ao atualizar o lead: ${error.message}`, 500)

  // lead inexistente devolve 200 com ok:false, para o Make/N8N não entrar
  // em retry infinito
  if (!data) {
    return json({ ok: false, lead_id: body.lead_id, motivo: 'lead não encontrado' })
  }

  return json({ ok: true, lead_id: data.id, nurture_status: status, channel: body.channel ?? null })
}))
