/**
 * Taxonomia de dores de vendas em pt-BR.
 *
 * Usada em dois pontos:
 *  - `search-pain` -> preenche `searches.detected_topics` (base da segmentação
 *    de audiência do painel /admin/audiencia);
 *  - `index-segments` -> preenche `video_segments.topic_tags`.
 *
 * É casamento por palavra-chave de propósito: roda sem custo de API, é
 * determinístico e mantém o mesmo vocabulário nos dois lados, o que faz o
 * cruzamento "tema × perfil comercial" fechar. A busca em si continua sendo
 * semântica (pgvector); isto aqui é só rotulagem para relatório.
 */

interface Topic {
  slug: string
  termos: string[]
}

const TAXONOMIA: Topic[] = [
  { slug: 'objecao-de-preco', termos: ['objeção de preço', 'objecao de preco', 'caro', 'preço alto', 'preco alto', 'desconto', 'valor alto', 'tá caro', 'ta caro', 'contornar objeção', 'contornar objecao'] },
  { slug: 'prospeccao', termos: ['prospecção', 'prospeccao', 'prospectar', 'captação de clientes', 'captacao de clientes', 'lista fria', 'novos clientes', 'gerar oportunidade'] },
  { slug: 'cold-call', termos: ['cold call', 'ligação fria', 'ligacao fria', 'abordagem por telefone', 'telefone frio'] },
  { slug: 'follow-up', termos: ['follow up', 'follow-up', 'followup', 'retomar contato', 'cliente sumiu', 'não responde', 'nao responde', 'ficou de retornar'] },
  { slug: 'fechamento', termos: ['fechamento', 'fechar venda', 'fechar negócio', 'fechar negocio', 'converter', 'assinar contrato', 'não fecha', 'nao fecha'] },
  { slug: 'negociacao', termos: ['negociação', 'negociacao', 'negociar', 'barganha', 'concessão', 'concessao'] },
  { slug: 'proposta-comercial', termos: ['proposta', 'orçamento', 'orcamento', 'apresentar proposta', 'sumiu depois da proposta'] },
  { slug: 'qualificacao-de-leads', termos: ['qualificação', 'qualificacao', 'lead qualificado', 'lead ruim', 'perfil de cliente', 'icp', 'curioso'] },
  { slug: 'funil-e-crm', termos: ['funil', 'pipeline', 'crm', 'etapas da venda', 'processo comercial', 'previsibilidade'] },
  { slug: 'script-e-abordagem', termos: ['script', 'abordagem', 'roteiro', 'pitch', 'primeira conversa', 'quebra-gelo'] },
  { slug: 'vendas-consultivas', termos: ['venda consultiva', 'vendas consultivas', 'diagnóstico', 'diagnostico', 'spin', 'perguntas certas', 'entender a dor'] },
  { slug: 'gestao-de-equipe', termos: ['gestão de equipe', 'gestao de equipe', 'liderar', 'liderança', 'lideranca', 'meu time', 'gerenciar vendedores', 'cobrar o time'] },
  { slug: 'metas-e-indicadores', termos: ['meta', 'metas', 'indicador', 'kpi', 'bater meta', 'previsão de vendas', 'previsao de vendas'] },
  { slug: 'comissionamento', termos: ['comissão', 'comissao', 'remuneração', 'remuneracao', 'premiação', 'premiacao', 'variável', 'variavel'] },
  { slug: 'motivacao-e-produtividade', termos: ['motivação', 'motivacao', 'desanimado', 'produtividade', 'disciplina', 'rotina do vendedor', 'time desmotivado'] },
  { slug: 'treinamento-e-onboarding', termos: ['treinamento', 'treinar', 'onboarding', 'vendedor novo', 'ramp up', 'capacitar'] },
  { slug: 'recrutamento', termos: ['contratar vendedor', 'recrutamento', 'seleção', 'selecao', 'perfil de vendedor', 'demitir'] },
  { slug: 'vendas-no-whatsapp', termos: ['whatsapp', 'zap', 'áudio para cliente', 'audio para cliente', 'mensagem para cliente'] },
  { slug: 'inside-sales', termos: ['inside sales', 'venda remota', 'venda por vídeo', 'venda por video', 'reunião online', 'reuniao online'] },
  { slug: 'pos-venda-e-fidelizacao', termos: ['pós-venda', 'pos venda', 'fidelização', 'fidelizacao', 'recompra', 'churn', 'cliente inativo', 'indicação', 'indicacao'] },
  { slug: 'rapport-e-relacionamento', termos: ['rapport', 'relacionamento', 'confiança', 'confianca', 'conexão com o cliente', 'conexao com o cliente'] },
  { slug: 'atendimento-e-experiencia', termos: ['atendimento', 'experiência do cliente', 'experiencia do cliente', 'reclamação', 'reclamacao'] },
  { slug: 'marketing-e-geracao-de-demanda', termos: ['marketing', 'tráfego', 'trafego', 'anúncio', 'anuncio', 'gerar demanda', 'branding pessoal'] },
  { slug: 'precificacao', termos: ['precificação', 'precificacao', 'formar preço', 'formar preco', 'margem', 'ticket médio', 'ticket medio'] },
  { slug: 'mentalidade-do-vendedor', termos: ['mentalidade', 'medo de vender', 'vergonha', 'autoconfiança', 'autoconfianca', 'resiliência', 'resiliencia', 'levar nao', 'levar não', 'ouvir nao', 'ouvir não'] },
]

/** Normaliza para comparação: minúsculas, sem acento, espaços colapsados. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Detecta os temas presentes em um texto livre.
 * Devolve no máximo `limite` slugs, ordenados por número de ocorrências.
 */
export function detectTopics(texto: string, limite = 5): string[] {
  const alvo = normalizar(texto)
  if (!alvo) return []

  const pontos = new Map<string, number>()
  for (const topico of TAXONOMIA) {
    let hits = 0
    for (const termo of topico.termos) {
      const t = normalizar(termo)
      // termos curtos (ex.: "nao") só contam como palavra inteira
      const padrao =
        t.length <= 4
          ? new RegExp(`(^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'g')
          : new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      hits += (alvo.match(padrao) ?? []).length
    }
    if (hits > 0) pontos.set(topico.slug, hits)
  }

  return [...pontos.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([slug]) => slug)
}

/** Rótulo legível para a UI. */
export function topicLabel(slug: string): string {
  return slug
    .split('-')
    .join(' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}

/**
 * Rótulo legível de cada tema, o MESMO mapa de src/lib/format.ts. Vive aqui
 * porque este arquivo já é o vocabulário canônico dos temas. O sync-nurture
 * tinha uma cópia com só 10 dos 25 temas: os outros 15 chegavam ao e-mail
 * como "pos venda e fidelizacao", sem acento e sem capitalização.
 */
const ROTULO_DO_TEMA: Record<string, string> = {
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

export function rotuloDoTema(slug: string): string {
  return ROTULO_DO_TEMA[slug] ?? slug.split('-').join(' ')
}
