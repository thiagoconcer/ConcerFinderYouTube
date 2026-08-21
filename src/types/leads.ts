/** Tipos do painel de leads (RPCs get_leads / get_lead_detail e nurture-status). */

export interface LeadResumo {
  profile_id: string
  nome: string
  email: string
  whatsapp: string
  cargo: string | null
  perfil_comercial: string
  papel: string
  cadastrado_em: string
  lead_id: string | null
  status_nutricao: string | null
  nutricao_enviada_em: string | null
  /** utm_source, senão o domínio do referrer, senão 'direto'. */
  origem: string | null
  campanha: string | null
  /** Conta da equipe. Só aparece quando a lista pede para incluir internos. */
  interno: boolean
  /** 0 a 100. Vem de score_do_lead no banco, nunca calculado aqui. */
  score: number
  /** 'quente' | 'morno' | 'frio', o mesmo corte que o data lake usa. */
  faixa: string
  total_buscas: number
  trechos_abertos: number
  ultima_busca: string | null
  ultima_atividade: string
  temas: string[]
  /** A dor mais recente, que é o assunto que a pessoa tem na cabeça agora. */
  ultima_dor: string | null
}

/** Retorno de `get_leads_facetas`: o que existe para filtrar, com contagem. */
export interface LeadsFacetas {
  total: number
  origens: Array<{ valor: string; total: number }>
  cargos: Array<{ valor: string; total: number }>
  temas: Array<{ valor: string; total: number }>
  reguas: Array<{ valor: string; total: number }>
}

/**
 * Situação na régua. Vem do ActiveCampaign, não do nosso banco, então pode
 * estar ausente sem que isso signifique erro.
 */
export interface SituacaoNutricao {
  fluxo: string | null
  etapa: string | null
  rotulo: string
}

export interface LeadDetalheDados {
  pessoa: {
    profile_id: string
    nome: string
    email: string
    whatsapp: string
    cargo: string | null
    perfil_comercial: string
    papel: string
    cadastrado_em: string
    status_nutricao: string | null
    nutricao_enviada_em: string | null
  } | null
  /**
   * Origem como foi capturada, e não a derivada do relatório de captação. Na
   * ficha de uma pessoa a pergunta é operacional (de qual anúncio, de qual
   * link), e aí a derivada esconde o que interessa. Null quando a pessoa se
   * cadastrou antes de o rastreio existir.
   */
  origem: {
    origem: string | null
    utm_source: string | null
    utm_medium: string | null
    utm_campaign: string | null
    utm_content: string | null
    utm_term: string | null
    referrer: string | null
    landing_page: string | null
    capturado_em: string | null
  } | null
  /**
   * Engajamento por e-mail desta pessoa. `ultimo_open` é agregado da conta
   * inteira no ActiveCampaign: abertura por campanha a API não entrega.
   */
  email: {
    recebidos: number
    cliques: number
    ultimo_open: string | null
    eventos: Array<{ campanha: string; tipo: 'enviado' | 'clique'; link: string | null; em: string }>
  } | null
  /** Composição do score, para a tela explicar o número sem recalculá-lo. */
  score: {
    total: number
    cargo: number
    atividade: number
    recencia: number
    foco: number
    buscas: number
    dias_ativos: number
    trechos_abertos: number
    cliques_cta: number
  }
  faixa: string
  resumo: {
    total_buscas: number
    trechos_abertos: number
    dias_ativos: number
    recomendacoes_recebidas: number
    cliques_cta: number
  }
  buscas: Array<{
    busca_id: string
    dor: string
    temas: string[]
    gerou_plano: boolean
    respondeu_contexto: boolean
    buscado_em: string
    trechos_recomendados: number
    trechos_abertos: number
  }>
  aberturas: Array<{
    video_id: string
    youtube_video_id: string
    titulo: string
    inicio_segundos: number
    aberto_em: string
  }>
}

/**
 * Retorno de `get_busca_detail`: o que a pessoa recebeu numa busca específica.
 * Vem separado de `LeadDetalheDados` porque é lido uma busca por vez, e o plano
 * de cada uma é grande demais para viajar junto com a ficha inteira.
 */
export interface BuscaDetalheDados {
  busca: {
    busca_id: string
    profile_id: string
    dor: string
    temas: string[]
    buscado_em: string
    plano: string | null
    plano_com_contexto: boolean
  }
  contexto: {
    pergunta: string | null
    opcoes: string[]
    resposta: string | null
    respondida_em: string | null
  }
  trechos: Array<{
    video_id: string
    youtube_video_id: string
    titulo: string
    thumbnail_url: string | null
    inicio_segundos: number
    relevancia: number
    posicao: number
    trecho: string | null
    abriu: boolean
  }>
}
