import { AppError, handler, json, optionalSecret } from '../_shared/http.ts'
import { requireUser, serviceClient } from '../_shared/supabase.ts'

/**
 * register-lead
 * Fecha o cadastro: garante o `profiles`, cria o `leads` e dispara a régua de
 * nutrição no webhook que a equipe já mantém (N8N / Make -> ActiveCampaign +
 * WhatsApp). Falha de webhook NÃO bloqueia o acesso à busca, só marca o lead
 * como `failed` para reprocessamento.
 */

const PAPEIS = ['vendedor', 'gestor_comercial', 'dono_empresa'] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

interface Body {
  profile_id?: string
  full_name?: string
  email?: string
  whatsapp?: string
  commercial_role?: string
}

/**
 * Dispara o sync com o ActiveCampaign sem bloquear a resposta ao usuário:
 * falha de CRM não pode impedir o acesso à busca, que é o que a pessoa está
 * esperando naquele instante.
 */
async function sincronizarNoAc(req: Request, profileId: string, aplicarGatilho: boolean) {
  try {
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-nurture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.get('Authorization') ?? '',
      },
      body: JSON.stringify({ profile_id: profileId, aplicar_gatilho: aplicarGatilho }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!r.ok) console.warn('sync-nurture respondeu', r.status, (await r.text()).slice(0, 200))
  } catch (error) {
    console.warn('sync-nurture falhou:', error)
  }
}

Deno.serve(handler(async (req) => {
  const user = await requireUser(req)
  const body: Body = await req.json().catch(() => ({}))

  // Impede gerar lead em nome de terceiro
  if (body.profile_id && body.profile_id !== user.id) {
    throw new AppError('Você só pode concluir o próprio cadastro.', 403, 'forbidden')
  }
  const profileId = user.id

  const fullName = (body.full_name ?? '').trim()
  const email = (body.email ?? user.email ?? '').trim().toLowerCase()
  const whatsapp = (body.whatsapp ?? '').trim()
  const commercialRole = (body.commercial_role ?? '').trim()

  if (fullName.length < 3) {
    throw new AppError('Informe o nome completo.', 400, 'invalid_name')
  }
  if (!EMAIL_RE.test(email)) {
    throw new AppError('E-mail inválido.', 400, 'invalid_email')
  }
  if (whatsapp.replace(/\D/g, '').length < 10) {
    throw new AppError('Informe o WhatsApp com DDD.', 400, 'invalid_whatsapp')
  }
  if (!PAPEIS.includes(commercialRole as (typeof PAPEIS)[number])) {
    throw new AppError(
      `Perfil comercial inválido. Use um de: ${PAPEIS.join(', ')}.`,
      400,
      'invalid_commercial_role',
    )
  }

  const db = serviceClient()

  // 1. garante o profile (o trigger handle_new_user já criou; isto cobre
  //    a corrida e atualiza os dados se o usuário corrigiu algo)
  const { error: profErr } = await db.from('profiles').upsert(
    {
      id: profileId,
      full_name: fullName,
      email,
      whatsapp,
      commercial_role: commercialRole,
    },
    { onConflict: 'id' },
  )
  if (profErr) throw new AppError(`Falha ao gravar o perfil: ${profErr.message}`, 500)

  // 2. idempotência: um lead por profile
  const { data: existente } = await db
    .from('leads')
    .select('id, nurture_status')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (existente) {
    return json({
      lead_id: existente.id,
      nurture_status: existente.nurture_status,
      message: 'Cadastro já concluído. Busca liberada.',
    })
  }

  const { data: lead, error: leadErr } = await db
    .from('leads')
    .insert({
      profile_id: profileId,
      full_name: fullName,
      email,
      whatsapp,
      commercial_role: commercialRole,
      nurture_status: 'pending',
    })
    .select('id')
    .single()

  if (leadErr) throw new AppError(`Falha ao registrar o lead: ${leadErr.message}`, 500)

  // 3. dispara a régua de nutrição existente
  const webhook = optionalSecret('NURTURE_WEBHOOK_URL')
  let nurtureStatus: 'pending' | 'sent' | 'failed' = 'pending'

  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(optionalSecret('NURTURE_WEBHOOK_TOKEN')
            ? { Authorization: `Bearer ${optionalSecret('NURTURE_WEBHOOK_TOKEN')}` }
            : {}),
        },
        body: JSON.stringify({
          lead_id: lead.id,
          profile_id: profileId,
          full_name: fullName,
          email,
          whatsapp,
          commercial_role: commercialRole,
          origem: 'concerfinder',
          created_at: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(15_000),
      })
      nurtureStatus = res.ok ? 'sent' : 'failed'
      if (!res.ok) {
        console.error('webhook de nutrição respondeu', res.status, (await res.text()).slice(0, 300))
      }
    } catch (error) {
      nurtureStatus = 'failed'
      console.error('webhook de nutrição falhou:', error)
    }

    await db
      .from('leads')
      .update({
        nurture_status: nurtureStatus,
        nurture_sent_at: nurtureStatus === 'sent' ? new Date().toISOString() : null,
      })
      .eq('id', lead.id)
  }

  // Cria o contato no ActiveCampaign com as tags de base. SEM gatilho: a
  // pessoa ainda não buscou nada, e a régua depende da dor real para o
  // primeiro e-mail fazer sentido. Quem dispara é o search-pain.
  await sincronizarNoAc(req, profileId, false)

  return json({
    lead_id: lead.id,
    nurture_status: nurtureStatus,
    message: 'Cadastro concluído. Busca liberada.',
  })
}))
