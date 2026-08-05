import Anthropic from 'npm:@anthropic-ai/sdk@0.115.0'
import { AppError, fetchJson, optionalSecret, requireSecret } from './http.ts'

/**
 * Integrações de IA do ConcerFinder.
 * Nenhuma dessas chaves pode existir no frontend: tudo roda aqui dentro.
 *
 * Divisão de trabalho entre os dois provedores:
 *  - OpenAI: embeddings. A Anthropic NÃO oferece API de embeddings (a API do
 *    Claude expõe Messages, Batches, Files, Token Counting e Models), então a
 *    vetorização dos segmentos e da consulta continua na OpenAI.
 *  - Claude: geração do plano de ação.
 */

// ------------------------------------------------------------------
// Embeddings (OpenAI)
// ------------------------------------------------------------------

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
// Plano de ação (Claude)
// ------------------------------------------------------------------

/** Trocável pelo secret ANTHROPIC_MODEL sem precisar republicar a função. */
const DEFAULT_CLAUDE_MODEL = 'claude-opus-5'

/**
 * Effort menor que o padrão porque a busca é síncrona: o usuário está olhando
 * a tela esperando o plano. `medium` mantém a qualidade e corta latência.
 * Ajustável pelo secret ANTHROPIC_EFFORT (low | medium | high | xhigh | max).
 */
const DEFAULT_EFFORT = 'medium'

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

/** Resposta usada quando a busca não encontrou trecho relevante. */
function planoSemResultado(): string {
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

export async function generateActionPlan(
  queryText: string,
  segmentos: PlanSegment[],
): Promise<string> {
  // Regra da doc: sem trechos relevantes, devolve orientação de refinar a dor.
  if (segmentos.length === 0) return planoSemResultado()

  const apiKey = requireSecret('ANTHROPIC_API_KEY')
  const model = optionalSecret('ANTHROPIC_MODEL') ?? DEFAULT_CLAUDE_MODEL
  const effort = optionalSecret('ANTHROPIC_EFFORT') ?? DEFAULT_EFFORT

  const client = new Anthropic({ apiKey })

  const contexto = segmentos
    .map(
      (s, i) =>
        `[Trecho ${i + 1}] Vídeo: ${s.title ?? 'sem título'} | Minutagem: ${formatarMinutagem(s.start_seconds)}\n${s.segment_text}`,
    )
    .join('\n\n')

  const system = `Você organiza os ensinamentos do Thiago Concer, a maior referência em vendas do Brasil, para vendedores, gestores comerciais e donos de empresa brasileiros.

Regras rígidas:
- Baseie-se SOMENTE nos trechos fornecidos. Se eles não cobrem parte da dor, diga isso abertamente em vez de inventar.
- Não cite estudos, números ou métodos que não estejam nos trechos.
- Fale direto com a pessoa, em segunda pessoa, com o tom direto e prático do Concer.
- Não use travessão. Use vírgula, ponto, parênteses ou dois-pontos.
- Entregue só o plano, sem introdução sobre você mesmo e sem repetir a dor inteira.
- Seja objetivo: cada frase precisa mudar o que a pessoa vai fazer. Nada de preâmbulo, ressalva longa ou recapitulação.`

  const prompt = `A pessoa descreveu esta dor de vendas:
"""
${queryText}
"""

Estes são os trechos das transcrições dos vídeos do canal que a busca semântica encontrou como mais relevantes. Eles são a sua única fonte.

${contexto}

Escreva um plano de ação em português brasileiro, exatamente nesta estrutura:

## O que está acontecendo
Um parágrafo curto conectando a dor descrita ao que os trechos mostram.

## Plano de ação
De 3 a 5 passos numerados. Cada passo precisa ser executável nesta semana e deve citar entre parênteses a minutagem do trecho que o embasa, no formato (Trecho N, min X:XX).

## Como saber se funcionou
Dois ou três sinais concretos e observáveis.`

  // O fallback de servidor só existe em Opus 5 e Fable 5. Mandar o parâmetro
  // para outro modelo (Sonnet 5, por exemplo) devolve 400, então ele é
  // condicional: assim trocar ANTHROPIC_MODEL não quebra a função.
  const suportaFallback = /^claude-(opus-5|fable-5|mythos-5)/.test(model)

  let resposta: any
  try {
    resposta = await client.beta.messages.create({
      model,
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort },
      // Os classificadores do Claude podem recusar uma requisição; o fallback
      // do servidor reexecuta em outro modelo em vez de devolver a recusa.
      ...(suportaFallback
        ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }
        : {}),
    } as any)
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AppError(
        'A ANTHROPIC_API_KEY é inválida. Confira a chave em Supabase → Edge Functions → Secrets.',
        502,
        'invalid_anthropic_key',
      )
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AppError(
        'A API do Claude está com limite de uso atingido. Tente de novo em alguns instantes.',
        429,
        'rate_limited',
      )
    }
    if (error instanceof Anthropic.NotFoundError) {
      throw new AppError(
        `O modelo ${model} não está disponível para esta chave. Ajuste o secret ANTHROPIC_MODEL.`,
        502,
        'model_not_available',
      )
    }
    if (error instanceof Anthropic.APIError) {
      throw new AppError(`Falha ao chamar a API do Claude: ${error.message}`, 502, 'upstream_error')
    }
    throw error
  }

  // Recusa chega como HTTP 200 com stop_reason 'refusal' e content vazio,
  // então precisa ser tratada antes de ler o conteúdo.
  if (resposta.stop_reason === 'refusal') {
    throw new AppError(
      'O modelo não pôde responder a essa consulta. Reformule a descrição da sua dor.',
      422,
      'refusal',
    )
  }

  const texto = (resposta.content ?? [])
    .filter((bloco: any) => bloco.type === 'text')
    .map((bloco: any) => bloco.text)
    .join('')
    .trim()

  if (!texto) {
    throw new AppError('O modelo não retornou um plano de ação.', 502, 'empty_completion')
  }
  return texto
}
