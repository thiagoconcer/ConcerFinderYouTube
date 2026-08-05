import { AppError, fetchJson, optionalSecret, requireSecret } from './http.ts'

/**
 * Obtenção da transcrição de um vídeo do YouTube.
 *
 * Por que legenda e não áudio: a Edge Function roda em Deno isolado, sem
 * yt-dlp e sem ffmpeg, então baixar e extrair áudio do YouTube ali dentro não
 * é viável. O caminho realista, e o que o docs/ESTRUTURA.md já previa ao citar
 * o Apify para "captura de legendas", é puxar a legenda com timestamps.
 *
 * Ordem de tentativa:
 *  1. timedtext público do YouTube (grátis, cobre vídeo com legenda ativada)
 *  2. Apify (APIFY_TOKEN), que também alcança legenda automática
 *  3. Whisper (OPENAI_API_KEY + AUDIO_SOURCE_URL), quando existe um serviço
 *     próprio que devolve o áudio do vídeo
 */

export interface TranscriptCue {
  text: string
  start: number
  duration: number
}

// ------------------------------------------------------------------
// 1. timedtext público
// ------------------------------------------------------------------
async function viaTimedText(videoId: string): Promise<TranscriptCue[]> {
  for (const lang of ['pt-BR', 'pt']) {
    try {
      const res = await fetch(
        `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}&fmt=json3`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ConcerFinder/1.0)' } },
      )
      if (!res.ok) continue
      const texto = await res.text()
      if (!texto.trim()) continue

      const data = JSON.parse(texto)
      const cues: TranscriptCue[] = (data.events ?? [])
        .filter((e: any) => e.segs)
        .map((e: any) => ({
          text: (e.segs ?? []).map((s: any) => s.utf8 ?? '').join('').replace(/\s+/g, ' ').trim(),
          start: (e.tStartMs ?? 0) / 1000,
          duration: (e.dDurationMs ?? 0) / 1000,
        }))
        .filter((c: TranscriptCue) => c.text.length > 0)

      if (cues.length > 0) return cues
    } catch {
      // tenta o próximo idioma / próxima estratégia
    }
  }
  return []
}

// ------------------------------------------------------------------
// 2. Apify
// ------------------------------------------------------------------
async function viaApify(videoId: string): Promise<TranscriptCue[]> {
  const token = optionalSecret('APIFY_TOKEN')
  if (!token) return []

  // actor configurável: o ecossistema de actors de transcrição muda com o tempo
  const actor = optionalSecret('APIFY_TRANSCRIPT_ACTOR') ?? 'topaz_sharingan~Youtube-Transcript-Scraper-1'

  const itens = await fetchJson(
    `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        videoUrls: [{ url: `https://www.youtube.com/watch?v=${videoId}` }],
      }),
      timeoutMs: 180_000,
    },
    'Apify (transcrição)',
  )

  const bruto = Array.isArray(itens) ? itens : []
  const cues: TranscriptCue[] = []
  for (const item of bruto) {
    const lista = item.transcript ?? item.captions ?? item.data ?? []
    for (const c of Array.isArray(lista) ? lista : []) {
      const text = String(c.text ?? c.snippet ?? '').replace(/\s+/g, ' ').trim()
      if (!text) continue
      cues.push({
        text,
        start: Number(c.start ?? c.offset ?? c.startMs / 1000 ?? 0),
        duration: Number(c.dur ?? c.duration ?? 0),
      })
    }
  }
  return cues
}

// ------------------------------------------------------------------
// 3. Whisper, quando há uma fonte de áudio configurada
// ------------------------------------------------------------------
async function viaWhisper(videoId: string): Promise<TranscriptCue[]> {
  const molde = optionalSecret('AUDIO_SOURCE_URL')
  if (!molde) return []

  const apiKey = requireSecret('OPENAI_API_KEY')
  const audioUrl = molde.replace('{video_id}', videoId)

  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) {
    throw new AppError(`Não foi possível baixar o áudio do vídeo ${videoId}.`, 502, 'audio_fetch_failed')
  }
  const audio = await audioRes.blob()

  const form = new FormData()
  form.append('file', audio, `${videoId}.mp3`)
  form.append('model', 'whisper-1')
  form.append('language', 'pt')
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) {
    throw new AppError(
      `Falha na transcrição via Whisper: ${(await res.text()).slice(0, 300)}`,
      502,
      'whisper_failed',
    )
  }
  const data = await res.json()
  return (data.segments ?? []).map((s: any) => ({
    text: String(s.text ?? '').trim(),
    start: Number(s.start ?? 0),
    duration: Number(s.end ?? 0) - Number(s.start ?? 0),
  }))
}

export async function fetchTranscript(videoId: string): Promise<TranscriptCue[]> {
  const estrategias: Array<[string, () => Promise<TranscriptCue[]>]> = [
    ['timedtext', () => viaTimedText(videoId)],
    ['apify', () => viaApify(videoId)],
    ['whisper', () => viaWhisper(videoId)],
  ]

  const falhas: string[] = []
  for (const [nome, executar] of estrategias) {
    try {
      const cues = await executar()
      if (cues.length > 0) return cues
      falhas.push(`${nome}: sem legenda`)
    } catch (error) {
      falhas.push(`${nome}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new AppError(
    `Nenhuma transcrição disponível para ${videoId}. Tentativas: ${falhas.join(' | ')}. ` +
      'Configure APIFY_TOKEN (legenda automática) ou AUDIO_SOURCE_URL + OPENAI_API_KEY (Whisper).',
    422,
    'no_transcript',
  )
}

/**
 * Agrupa as legendas em janelas de tempo maiores.
 * Legenda vem em pedaços de 2 a 5 segundos, curtos demais para virar um
 * insight pesquisável; o embedding fica melhor com blocos de ~45s.
 */
export function buildSegments(
  cues: TranscriptCue[],
  janelaSegundos = 45,
  maxCaracteres = 1200,
): Array<{ segment_text: string; start_seconds: number; end_seconds: number }> {
  const segmentos: Array<{ segment_text: string; start_seconds: number; end_seconds: number }> = []
  let atual: TranscriptCue[] = []
  let inicio = cues[0]?.start ?? 0

  const fechar = (fim: number) => {
    const texto = atual.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim()
    if (texto.length > 20) {
      segmentos.push({
        segment_text: texto.slice(0, 4000),
        start_seconds: Math.max(0, Math.floor(inicio)),
        end_seconds: Math.max(Math.floor(fim), Math.floor(inicio) + 1),
      })
    }
    atual = []
  }

  for (const cue of cues) {
    if (atual.length === 0) inicio = cue.start
    atual.push(cue)

    const fim = cue.start + (cue.duration || 0)
    const tamanho = atual.reduce((n, c) => n + c.text.length + 1, 0)
    if (fim - inicio >= janelaSegundos || tamanho >= maxCaracteres) {
      fechar(fim)
    }
  }
  if (atual.length > 0) {
    const ultimo = atual[atual.length - 1]
    fechar(ultimo.start + (ultimo.duration || 0))
  }

  return segmentos
}
