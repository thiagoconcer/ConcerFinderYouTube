import { AppError, handler, json, optionalSecret } from '../_shared/http.ts'
import { requireStaffOrService, serviceClient } from '../_shared/supabase.ts'

/**
 * sync-email-events
 * Traz do ActiveCampaign o que a régua provocou: quem recebeu cada e-mail e
 * quem clicou em qual link. Grava em `email_events` e `email_contatos`.
 *
 * POR QUE SINCRONIZAR E NÃO CONSULTAR AO VIVO. O painel agrega dezenas de
 * pessoas por vez; consultar o ActiveCampaign a cada carga custaria segundos e
 * deixaria o dashboard dependente de um terceiro estar de pé. A lista de leads
 * já paga esse preço para mostrar a etapa da régua, e ali é uma pessoa por vez.
 *
 * O QUE A API ENTREGA, e por isso o que existe aqui:
 *  - `logs?filters[campaignid]=`  envio por contato, exato
 *  - `links/{id}/linkData`        clique por contato, com link, exato
 *  - campos do contato            último open e último clique, agregados da
 *                                 conta inteira; abertura por campanha a API
 *                                 não expõe, então não invento uma
 *
 * Idempotente: o índice único em (contato, campanha, tipo, link, data) faz
 * cada rodada reprocessar o mesmo período sem duplicar nada.
 */

// mesma base e mesmo secret do _shared/activecampaign.ts: dois nomes para a
// mesma credencial seria uma configuração a mais para esquecer de preencher
const AC_URL = () => optionalSecret('ACTIVECAMPAIGN_API_URL') ?? 'https://thiagoconcer56558.api-us1.com'
const AC_KEY = () => optionalSecret('ACTIVECAMPAIGN_API_TOKEN') ?? ''
/** Só as campanhas do ConcerFinder: o resto da conta não é assunto do painel. */
const PREFIXO = '[CF]'

async function ac(caminho: string): Promise<Record<string, any>> {
  const res = await fetch(`${AC_URL()}/api/3/${caminho}`, {
    headers: { 'Api-Token': AC_KEY(), Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new AppError(`ActiveCampaign respondeu ${res.status} em ${caminho}`, 502)
  return await res.json()
}

Deno.serve(handler(async (req) => {
  await requireStaffOrService(req)
  if (!AC_URL() || !AC_KEY()) {
    throw new AppError('ActiveCampaign não configurado nesta instalação.', 503, 'ac_nao_configurado')
  }

  const db = serviceClient()

  // e-mail -> profile_id. A base do AC é maior que a do produto: contato sem
  // conta aqui é ignorado, senão o painel contaria gente que nunca entrou.
  const { data: perfis } = await db.from('profiles').select('id, email')
  const porEmail = new Map<string, string>()
  for (const p of perfis ?? []) porEmail.set(String(p.email).toLowerCase(), p.id as string)

  // filtro pelo nome, e não paginação: a conta tem 191 campanhas e as do
  // ConcerFinder não cabem nas primeiras 100 de nenhuma ordenação
  const busca = new URLSearchParams({ 'filters[name]': PREFIXO, limit: '50' })
  const doCF = ((await ac(`campaigns?${busca}`)).campaigns ?? []).filter(
    (c: Record<string, any>) => String(c.name ?? '').startsWith(PREFIXO),
  )

  const eventos: Record<string, unknown>[] = []
  const contatosVistos = new Set<string>()

  for (const c of doCF) {
    // 1. envios
    const logs = (await ac(`logs?filters[campaignid]=${c.id}&limit=100`)).logs ?? []
    for (const l of logs) {
      const contato = String(l.contact ?? '')
      contatosVistos.add(contato)
      eventos.push({
        ac_contact_id: contato,
        campaign_id: String(c.id),
        campaign_name: c.name,
        message_id: String(l.messageid ?? ''),
        tipo: 'enviado',
        link_url: null,
        ocorrido_em: l.tstamp,
      })
    }

    // 2. cliques, link a link
    const links = (await ac(`campaigns/${c.id}/links`)).links ?? []
    for (const link of links) {
      // 'open' é o pixel de abertura, não é link clicável
      if (!String(link.link ?? '').startsWith('http')) continue
      const dados = (await ac(`links/${link.id}/linkData?limit=100`)).linkData ?? []
      for (const d of dados) {
        const contato = String(d.subscriberid ?? '')
        contatosVistos.add(contato)
        eventos.push({
          ac_contact_id: contato,
          email: String(d.email ?? '').toLowerCase(),
          campaign_id: String(c.id),
          campaign_name: c.name,
          message_id: String(d.messageid ?? ''),
          tipo: 'clique',
          link_url: link.link,
          ocorrido_em: d.tstamp,
        })
      }
    }
  }

  // o log de envio não traz e-mail, então o contato é resolvido uma vez só
  const emailPorContato = new Map<string, string>()
  for (const e of eventos) {
    if (e.email) emailPorContato.set(String(e.ac_contact_id), String(e.email))
  }
  const semEmail = [...contatosVistos].filter((id) => !emailPorContato.has(id))
  for (const id of semEmail) {
    try {
      const c = (await ac(`contacts/${id}`)).contact
      if (c?.email) emailPorContato.set(id, String(c.email).toLowerCase())
    } catch {
      // contato apagado no AC: o evento dele fica de fora, não trava a rodada
    }
  }

  const prontos = eventos
    .map((e) => {
      const email = String(e.email ?? emailPorContato.get(String(e.ac_contact_id)) ?? '')
      return { ...e, email, profile_id: porEmail.get(email) ?? null }
    })
    .filter((e) => e.email && e.profile_id)

  let gravados = 0
  for (let i = 0; i < prontos.length; i += 200) {
    const lote = prontos.slice(i, i + 200)
    const { error } = await db.from('email_events').upsert(lote, {
      // casa com idx_email_events_unico, que é NULLS NOT DISTINCT: envio tem
      // link nulo e dois envios iguais precisam colidir em vez de duplicar
      onConflict: 'ac_contact_id,campaign_id,tipo,link_url,ocorrido_em',
      ignoreDuplicates: true,
    })
    if (error) throw new AppError(`Falha ao gravar eventos: ${error.message}`, 500)
    gravados += lote.length
  }

  // 3. agregados por contato: responde "essa pessoa lê e-mail?"
  let contatos = 0
  for (const [acId, email] of emailPorContato) {
    const profileId = porEmail.get(email)
    if (!profileId) continue
    try {
      const c = (await ac(`contacts/${acId}`)).contact
      await db.from('email_contatos').upsert({
        profile_id: profileId,
        ac_contact_id: acId,
        enviados_na_conta: Number(c?.sentcnt ?? 0),
        ultimo_open: c?.last_open_date || null,
        ultimo_clique: c?.last_click_date || null,
        bounce: String(c?.bounced_hard ?? '0') !== '0',
        atualizado_em: new Date().toISOString(),
      })
      contatos += 1
    } catch {
      // idem: um contato ruim não derruba a sincronização inteira
    }
  }

  return json({
    campanhas: doCF.length,
    eventos_lidos: eventos.length,
    eventos_gravados: gravados,
    contatos_atualizados: contatos,
  })
}))
