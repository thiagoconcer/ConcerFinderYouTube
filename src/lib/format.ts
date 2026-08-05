/** Formata segundos como minutagem: 90 -> "1:30", 3725 -> "1:02:05". */
export function formatTimestamp(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(seg).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/** Deep-link do YouTube já no minuto do insight. */
export function youtubeUrl(youtubeVideoId: string, startSeconds?: number): string {
  const base = `https://www.youtube.com/watch?v=${youtubeVideoId}`
  return startSeconds && startSeconds > 0 ? `${base}&t=${Math.floor(startSeconds)}s` : base
}

/** Embed do player começando no trecho relevante. */
export function youtubeEmbedUrl(youtubeVideoId: string, startSeconds?: number): string {
  const start = startSeconds && startSeconds > 0 ? `?start=${Math.floor(startSeconds)}` : ''
  return `https://www.youtube.com/embed/${youtubeVideoId}${start}`
}

export function thumbnailUrl(youtubeVideoId: string, fallback?: string | null): string {
  return fallback || `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`
}

/** Rótulo legível de um slug de tema ("objecao-de-preco" -> "Objecao de preco"). */
export function topicLabel(slug: string): string {
  const rotulos: Record<string, string> = {
    'objecao-de-preco': 'Objeção de preço',
    prospeccao: 'Prospecção',
    'cold-call': 'Cold call',
    'follow-up': 'Follow-up',
    fechamento: 'Fechamento',
    negociacao: 'Negociação',
    'proposta-comercial': 'Proposta comercial',
    'qualificacao-de-leads': 'Qualificação de leads',
    'funil-e-crm': 'Funil e CRM',
    'script-e-abordagem': 'Script e abordagem',
    'vendas-consultivas': 'Vendas consultivas',
    'gestao-de-equipe': 'Gestão de equipe',
    'metas-e-indicadores': 'Metas e indicadores',
    comissionamento: 'Comissionamento',
    'motivacao-e-produtividade': 'Motivação e produtividade',
    'treinamento-e-onboarding': 'Treinamento e onboarding',
    recrutamento: 'Recrutamento',
    'vendas-no-whatsapp': 'Vendas no WhatsApp',
    'inside-sales': 'Inside sales',
    'pos-venda-e-fidelizacao': 'Pós-venda e fidelização',
    'rapport-e-relacionamento': 'Rapport e relacionamento',
    'atendimento-e-experiencia': 'Atendimento e experiência',
    'marketing-e-geracao-de-demanda': 'Marketing e geração de demanda',
    precificacao: 'Precificação',
    'mentalidade-do-vendedor': 'Mentalidade do vendedor',
  }
  return rotulos[slug] ?? slug.split('-').join(' ')
}

const dataFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'sem data'
  return dataFormatter.format(new Date(iso))
}

const dataHoraFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'sem data'
  return dataHoraFormatter.format(new Date(iso))
}

/** Relevância como percentual, para o badge do card de resultado. */
export function formatScore(score: number): string {
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`
}
