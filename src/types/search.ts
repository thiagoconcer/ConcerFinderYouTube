/** Tipos do fluxo de busca, espelhando o retorno das Edge Functions e RPCs. */

export interface SearchHit {
  search_id: string
  video_id: string
  youtube_video_id: string
  title: string
  thumbnail_url: string | null
  segment_id: string
  segment_text: string
  start_seconds: number
  end_seconds: number
  similarity_score: number
  rank_position: number
}

/** Resposta da Edge Function `search-pain`. */
export interface SearchPainResponse {
  search_id: string | null
  query_text: string
  detected_topics: string[]
  results: SearchHit[]
  total: number
}

/** Resposta da Edge Function `generate-action-plan`. */
export interface ActionPlanResponse {
  search_id: string
  action_plan: string
  cached: boolean
  /** true quando o plano foi escrito já com a resposta de contexto. */
  has_context?: boolean
}

/**
 * Resposta da Edge Function `context-question`: a pergunta que refina o plano.
 * `question` vem null quando não vale perguntar (dor já detalhada, busca sem
 * trecho) ou quando a geração falhou. Nos dois casos a tela não mostra a caixa.
 */
export interface ContextQuestionResponse {
  search_id: string
  question: string | null
  options: string[]
  answered: boolean
  cached?: boolean
}

/** Linha da RPC `get_search_results`. */
export interface SearchResultRow extends SearchHit {
  query_text: string
  detected_topics: string[] | null
  action_plan: string | null
  searched_at: string
}

/** Retorno da RPC `get_video_detail`. */
export interface VideoDetail {
  video: {
    id: string
    youtube_video_id: string
    title: string
    description: string | null
    thumbnail_url: string | null
    duration_seconds: number | null
    published_at: string | null
    transcription_status: string
  }
  segments: Array<{
    segment_id: string
    segment_text: string
    start_seconds: number
    end_seconds: number
    topic_tags: string[] | null
    similarity_score: number | null
  }>
}

/** Retorno da RPC `get_content_dashboard`. */
export interface ContentDashboard {
  videos: Record<string, number>
  total_videos: number
  total_segmentos: number
  segmentos_com_embedding: number
  ultima_ingestao: {
    run_type: string
    status: string
    started_at: string
    finished_at: string | null
  } | null
}

/** Um trecho no ranking de recomendados ou assistidos. */
export interface TrechoRanking {
  segment_id: string | null
  video_id: string
  youtube_video_id: string
  title: string
  start_seconds: number
  trecho: string
  vezes: number
  score_medio?: number
}

/** Retorno da RPC `get_audience_insights`. */
export interface AudienceInsights {
  periodo: { de: string; ate: string }
  totais: {
    leads: number
    perfis: number
    buscas: number
    visualizacoes: number
    videos_indexados: number
  }
  leads_por_perfil: Array<{ commercial_role: string; total: number }>
  nutricao: Record<string, number>
  temas: Array<{ topico: string; total: number }>
  temas_por_perfil: Array<{ topico: string; commercial_role: string; total: number }>
  /** Quem procura o quê: por perfil comercial, os temas que ele mais busca. */
  perfis_por_tema: Array<{
    commercial_role: string
    total: number
    temas: Array<{ topico: string; total: number }>
  }>
  trechos_mais_recomendados: TrechoRanking[]
  trechos_mais_assistidos: TrechoRanking[]
  videos_mais_recomendados: Array<{
    video_id: string
    youtube_video_id: string
    title: string
    thumbnail_url: string | null
    recomendacoes: number
    visualizacoes: number
  }>
  buscas_sem_resultado: Array<{ query_text: string; created_at: string }>
}

/**
 * Retorno de `get_engagement_insights`: crescimento, ativação, qualidade da
 * busca e pauta de conteúdo. Separado de `AudienceInsights` porque responde
 * outras perguntas (o produto está funcionando? o acervo dá conta?).
 */
export interface EngagementInsights {
  periodo: { de: string; ate: string }
  serie: Array<{ dia: string; cadastros: number; buscas: number; aberturas: number }>
  funil: { cadastraram: number; buscaram: number; abriram: number; voltaram: number }
  qualidade: {
    buscas: number
    buscas_com_plano: number
    buscas_sem_resultado: number
    /** Similaridade de cosseno do melhor trecho de cada busca. Null sem buscas. */
    relevancia_media: number | null
    relevancia_minima: number | null
    recomendacoes: number
    aberturas: number
    buscas_por_pessoa: number | null
  }
  demanda_por_tema: Array<{
    topico: string
    buscas: number
    relevancia_media: number | null
    trechos_no_acervo: number
  }>
  acervo: {
    indexados: number
    ja_recomendados: number
    nunca_recomendados: number
    amostra: Array<{
      video_id: string
      youtube_video_id: string
      title: string
      thumbnail_url: string | null
      trechos: number
    }>
  }
  recorrencia: Array<{ dias_ativos: number; pessoas: number }>
}

/** Retorno de `get_origem_insights`: de onde vêm os leads. */
export interface OrigemInsights {
  periodo: { de: string; ate: string }
  total_leads: number
  por_origem: Array<{
    origem: string
    leads: number
    ativaram: number
    taxa_ativacao: number | null
  }>
  por_campanha: Array<{
    origem: string
    meio: string
    campanha: string
    leads: number
    ativaram: number
  }>
  serie: Array<{ dia: string; origem: string; leads: number }>
}

/** Retorno de `get_cta_insights`: o convite do parceiro no plano de ação. */
export interface CtaInsights {
  periodo: { de: string; ate: string }
  planos_com_convite: number
  pessoas_que_viram: number
  cliques: number
  pessoas_que_clicaram: number
  taxa: number | null
  por_perfil: Array<{ perfil: string; viram: number; clicaram: number }>
  por_tema: Array<{ tema: string; cliques: number }>
  ultimos: Array<{
    profile_id: string
    nome: string
    cargo: string | null
    perfil: string
    dor: string | null
    clicado_em: string
  }>
  serie: Array<{ dia: string; cliques: number }>
}

/**
 * Retorno de `get_cargo_insights`. O cargo é a granularidade fina do cadastro
 * (9 opções); o `commercial_role` que vem junto é a régua de nutrição para a
 * qual aquele cargo aponta.
 */
export interface CargoInsights {
  periodo: { de: string; ate: string }
  pessoas_por_cargo: Array<{ cargo: string; commercial_role: string; total: number }>
  temas_por_cargo: Array<{
    cargo: string
    total: number
    temas: Array<{ topico: string; total: number }>
  }>
  buscas_no_periodo: number
}

/** Retorno de `get_contexto_insights`: a pergunta de contexto está pegando? */
export interface ContextoInsights {
  periodo: { de: string; ate: string }
  funil: {
    buscas: number
    com_pergunta: number
    responderam: number
    planos_refinados: number
  }
  por_perfil: Array<{ perfil: string; com_pergunta: number; responderam: number }>
  /** Aberturas por busca dos dois lados. Null quando não houve busca do lado. */
  efeito: {
    com_contexto: { buscas: number; aberturas_por_busca: number | null }
    sem_contexto: { buscas: number; aberturas_por_busca: number | null }
  }
  ultimas: Array<{
    busca_id: string
    profile_id: string
    perfil: string
    dor: string
    pergunta: string | null
    resposta: string | null
    respondida_em: string | null
  }>
  ignoradas: Array<{ dor: string; pergunta: string | null; buscado_em: string }>
}

/**
 * Retorno de `get_email_insights`: o que a régua provoca, do lado de quem
 * recebe. A métrica é clique, não abertura: a API do ActiveCampaign não expõe
 * abertura por campanha, e abertura virou número ruim desde que o Apple Mail
 * passou a abrir e-mail sozinho.
 */
export interface EmailInsights {
  periodo: { de: string; ate: string }
  totais: {
    pessoas_que_receberam: number
    pessoas_que_clicaram: number
    envios: number
    cliques: number
  }
  por_email: Array<{
    campanha: string
    campaign_id: string
    receberam: number
    clicaram: number
    taxa: number | null
  }>
  /** As duas portas do convite do parceiro, contando pessoas e não cliques. */
  convite_parceiro: { pelo_email: number; pelo_app: number; pessoas_no_total: number }
  clicou_e_nao_buscou: Array<{
    profile_id: string
    nome: string
    email: string
    perfil: string
    ultimo_clique: string
  }>
  ultimos_cliques: Array<{
    nome: string
    profile_id: string
    campanha: string
    link: string
    em: string
  }>
  /** Agregados do contato no ActiveCampaign, da conta inteira. */
  leitores: { com_open_registrado: number; com_clique_registrado: number; com_bounce: number }
}
