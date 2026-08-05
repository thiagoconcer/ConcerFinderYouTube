import { AppError, handler, json } from '../_shared/http.ts'
import { isCronCall, isServiceRoleCall, requireUser, serviceClient } from '../_shared/supabase.ts'
import {
  acConfigurado,
  sincronizarLead,
  type DadosDoLead,
  type PerfilComercial,
} from '../_shared/activecampaign.ts'

/**
 * sync-nurture
 * Empurra o lead para o ActiveCampaign com a personalização real: a dor que a
 * pessoa escreveu, os temas detectados e o link do trecho no minuto exato.
 *
 * Chamada em dois momentos:
 *  - no cadastro (por register-lead), sem gatilho: cria o contato e aplica as
 *    tags de base. A automação ainda não dispara porque não há dor para contar.
 *  - depois de uma busca (por search-pain), com gatilho: preenche os campos e
 *    aplica a tag do perfil, que é o que faz a régua começar.
 *
 * Idempotente: `contact/sync` faz upsert por e-mail e o AC ignora tag repetida.
 */

interface Body {
  profile_id?: string
  /** true depois de uma busca: aplica a tag que dispara a automação. */
  aplicar_gatilho?: boolean
}

/**
 * Base dos links que vão nos e-mails da régua. Configurável por secret para
 * que uma troca de domínio não exija republicar a função: o link do trecho é
 * o que a pessoa clica, e ele fica gravado no contato do ActiveCampaign.
 */
const APP_URL = Deno.env.get('APP_URL') ?? 'https://finder.thiagoconcer.com.br'

function minutagem(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

const ROTULO_TEMA: Record<string, string> = {
  'objecao-de-preco': 'Objeção de preço',
  prospeccao: 'Prospecção',
  'follow-up': 'Follow-up',
  fechamento: 'Fechamento',
  negociacao: 'Negociação',
  'gestao-de-equipe': 'Gestão de equipe',
  'metas-e-indicadores': 'Metas e indicadores',
  'vendas-consultivas': 'Vendas consultivas',
  'script-e-abordagem': 'Script e abordagem',
  'funil-e-crm': 'Funil e CRM',
}

const legivel = (slug: string) => ROTULO_TEMA[slug] ?? slug.split('-').join(' ')

Deno.serve(handler(async (req) => {
  const interno = isCronCall(req) || isServiceRoleCall(req)
  const user = interno ? null : await requireUser(req)

  const body: Body = await req.json().catch(() => ({}))
  const profileId = interno ? body.profile_id : user!.id

  if (!profileId) throw new AppError('profile_id é obrigatório.', 400, 'missing_profile_id')

  if (!acConfigurado()) {
    // Sem a chave, o cadastro não pode quebrar: a régua é importante, mas o
    // acesso à busca é o que o usuário está esperando naquele instante.
    return json({ sincronizado: false, motivo: 'ACTIVECAMPAIGN_API_TOKEN não configurada' }, 200)
  }

  const db = serviceClient()

  const { data: perfil, error } = await db
    .from('profiles')
    .select('id, full_name, email, whatsapp, commercial_role, cargo, created_at')
    .eq('id', profileId)
    .maybeSingle()

  if (error) throw new AppError(`Falha ao carregar o perfil: ${error.message}`, 500)
  if (!perfil) throw new AppError('Perfil não encontrado.', 404, 'profile_not_found')

  // última busca da pessoa, que é a dor mais fresca para o e-mail
  const { data: ultima } = await db
    .from('searches')
    .select('id, query_text, detected_topics')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { count: totalBuscas } = await db
    .from('searches')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)

  const { count: totalAberturas } = await db
    .from('video_views')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)

  const dados: DadosDoLead = {
    nome: perfil.full_name,
    email: perfil.email,
    whatsapp: perfil.whatsapp,
    perfil: perfil.commercial_role as PerfilComercial,
    cargo: perfil.cargo,
    cadastradoEm: perfil.created_at,
    totalBuscas: totalBuscas ?? 0,
    abriuAlgumTrecho: (totalAberturas ?? 0) > 0,
  }

  // top recomendação da última busca: é o link que vai no primeiro e-mail
  if (ultima) {
    dados.dorPrincipal = ultima.query_text
    dados.temas = (ultima.detected_topics ?? []).map(legivel)

    const { data: topo } = await db
      .from('search_results')
      .select('video_id, segment_id, start_seconds, videos(title)')
      .eq('search_id', ultima.id)
      .order('rank_position')
      .limit(1)
      .maybeSingle()

    if (topo) {
      const t = topo as Record<string, any>
      dados.videoRecomendado = t.videos?.title ?? undefined
      dados.minutagem = minutagem(t.start_seconds)
      dados.linkTrecho = `${APP_URL}/video/${t.video_id}?t=${t.start_seconds}&s=${t.segment_id}`
    }
  }

  // Só dispara a régua quando existe dor real para contar. Sem isso o primeiro
  // e-mail sairia sem justamente aquilo que o ConcerFinder tem de diferente.
  const aplicarGatilho = Boolean(body.aplicar_gatilho && dados.dorPrincipal)

  const resultado = await sincronizarLead(dados, aplicarGatilho)

  return json({
    sincronizado: true,
    contato_id: resultado.contatoId,
    tags: resultado.tagsAplicadas,
    gatilho_aplicado: resultado.gatilhoAplicado,
    tem_dor: Boolean(dados.dorPrincipal),
    total_buscas: dados.totalBuscas,
  })
}))
