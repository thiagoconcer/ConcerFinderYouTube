import { AppError, fetchJson, optionalSecret, requireSecret } from './http.ts'

/**
 * Integrações de IA do ConcerFinder.
 * Nenhuma dessas chaves pode existir no frontend: tudo roda aqui dentro.
 */

export const EMBEDDING_MODEL = 'text-embedding-3-small' // 1536 dims, casa com vector(1536)
export const EMBEDDING_DIMS = 1536

/** Gera embeddings em lote (a API da OpenAI aceita array de inputs). */
export async function embedTexts(textos: string[]): Promise<number[][]> {
  const limpos = textos.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (limpos.length !== textos.length) {
    throw new AppError('Texto vazio enviado para embedding.', 400, 'empty_input')
  }
  if (limpos.length === 0) return []

  const apiKey = requireSecret('OPENAI_API_KEY')
  const data = await fetchJson(
    'https://api.openai.com/v1/embeddings',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: limpos }),
      timeoutMs: 120_000,
    },
    'API de embeddings da OpenAI',
  )

  const vetores: number[][] = data.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => d.embedding)

  for (const v of vetores) {
    if (v.length !== EMBEDDING_DIMS) {
      throw new AppError(
        `Embedding com ${v.length} dimensões; a coluna espera ${EMBEDDING_DIMS}.`,
        500,
        'dimension_mismatch',
      )
    }
  }
  return vetores
}

export async function embedText(texto: string): Promise<number[]> {
  const [vetor] = await embedTexts([texto])
  return vetor
}

// ------------------------------------------------------------------
// Plano de ação (Gemini)
// ------------------------------------------------------------------

/**
 * Gemini 2.5 Pro por padrão (contexto longo, consolida vários trechos).
 * GEMINI_MODEL permite trocar para um modelo Flash em pico de buscas,
 * como o docs/ESTRUTURA.md prevê.
 */
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro'

export interface PlanSegment {
  title?: string
  segment_text: string
  start_seconds: number
}

function formatarMinutagem(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(seg).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export async function generateActionPlan(
  queryText: string,
  segmentos: PlanSegment[],
): Promise<string> {
  if (segmentos.length === 0) {
    // Regra da doc: sem trechos relevantes, devolve orientação de refinar a dor.
    return [
      'Não encontramos trechos suficientemente relevantes para essa dor no acervo do canal.',
      '',
      'Tente descrever a situação com mais contexto do seu dia a dia. Em vez de "preciso vender mais", algo como:',
      '- "meu time trava quando o cliente diz que o preço está alto"',
      '- "não consigo fazer meus vendedores retomarem contato com quem pediu proposta"',
      '',
      'Quanto mais próxima da conversa real com o cliente, melhor a busca encontra o momento exato em que o Concer trata do assunto.',
    ].join('\n')
  }

  const apiKey = requireSecret('GEMINI_API_KEY')
  const model = optionalSecret('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL

  const contexto = segmentos
    .map(
      (s, i) =>
        `[Trecho ${i + 1}] Vídeo: ${s.title ?? 'sem título'} | Minutagem: ${formatarMinutagem(s.start_seconds)}\n${s.segment_text}`,
    )
    .join('\n\n')

  const prompt = `Você é um assistente que organiza os ensinamentos do Thiago Concer, a maior referência em vendas do Brasil, para vendedores, gestores comerciais e donos de empresa brasileiros.

A pessoa descreveu esta dor de vendas:
"""
${queryText}
"""

Abaixo estão os trechos das transcrições dos vídeos do canal que a busca semântica encontrou como mais relevantes. Eles são a SUA ÚNICA FONTE.

${contexto}

Escreva um plano de ação prático, em português brasileiro, seguindo exatamente esta estrutura:

## O que está acontecendo
Um parágrafo curto conectando a dor descrita ao que os trechos mostram.

## Plano de ação
De 3 a 5 passos numerados. Cada passo precisa ser algo que a pessoa consiga executar nesta semana, e deve citar entre parênteses a minutagem do trecho que o embasa, no formato (Trecho N, min X:XX).

## Como saber se funcionou
Dois ou três sinais concretos e observáveis.

Regras rígidas:
- Baseie-se SOMENTE nos trechos acima. Se eles não cobrem parte da dor, diga isso abertamente em vez de inventar.
- Não cite estudos, números ou métodos que não estejam nos trechos.
- Fale direto com a pessoa, em segunda pessoa, com o tom direto e prático do Concer, sem enrolação.
- Não use travessão. Use vírgula, ponto, parênteses ou dois-pontos.
- Não repita a dor inteira nem faça introdução sobre você mesmo.`

  const data = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
      timeoutMs: 120_000,
    },
    'API do Gemini',
  )

  const texto = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text ?? '')
    .join('')
    .trim()

  if (!texto) {
    throw new AppError('O modelo não retornou um plano de ação.', 502, 'empty_completion')
  }
  return texto
}
