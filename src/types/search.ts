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
