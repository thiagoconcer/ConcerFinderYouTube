import {
  AppError,
  ehErroDeCota,
  fetchJson,
  mensagemDeCota,
  optionalSecret,
  requireSecret,
} from './http.ts'

/**
 * Obtenção da transcrição de um vídeo do YouTube.
 *
 * Por que legenda e não áudio: a Edge Function roda em Deno isolado, sem
 * yt-dlp e sem ffmpeg, então baixar e extrair áudio do YouTube ali dentro não
 * é viável. O caminho realista é puxar a legenda com timestamps.
 *
 * IMPORTANTE (verificado em 05/08/2026): o YouTube passou a responder
 * `LOGIN_REQUIRED` ("faça login para confirmar que você não é um bot") para
 * requisições anônimas vindas de IP de datacenter, o que inclui as Edge
 * Functions. Os caminhos públicos (timedtext e player interno) não funcionam
 * mais nesse ambiente. O caminho oficial e gratuito é a YouTube Data API com
 * OAuth do DONO do canal, que é o caso da Concer.
 *
 * Ordem de tentativa:
 *  1. YouTube Data API com OAuth do dono do canal (oficial, grátis, principal)
 *  2. timedtext público (mantido: funciona de IP residencial e pode voltar)
 *  3. Apify (APIFY_TOKEN), serviço pago que contorna o bloqueio por conta própria
 *  4. Whisper (OPENAI_API_KEY + AUDIO_SOURCE_URL), quando existe um serviço
 *     próprio que devolve o áudio do vídeo
 */

export interface TranscriptCue {
  text: string
  start: number
  duration: number
}

// ------------------------------------------------------------------
// 1. YouTube Data API (OAuth do dono do canal)
// ------------------------------------------------------------------

/** Cache do access token enquanto a instância da função viver. */
let tokenCache: { valor: string; expiraEm: number } | null = null

async function accessTokenDoDono(): Promise<string | null> {
  const clientId = optionalSecret('YOUTUBE_OAUTH_CLIENT_ID')
  const clientSecret = optionalSecret('YOUTUBE_OAUTH_CLIENT_SECRET')
  const refreshToken = optionalSecret('YOUTUBE_OAUTH_REFRESH_TOKEN')
  if (!clientId || !clientSecret || !refreshToken) return null

  if (tokenCache && tokenCache.expiraEm > Date.now() + 60_000) return tokenCache.valor

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    throw new AppError(
      `Não foi possível renovar o token do YouTube: ${(await res.text()).slice(0, 200)}. ` +
        'Confira YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET e YOUTUBE_OAUTH_REFRESH_TOKEN.',
      502,
      'youtube_oauth_failed',
    )
  }

  const data = await res.json()
  tokenCache = {
    valor: data.access_token,
    expiraEm: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
  return tokenCache.valor
}

/** Converte SRT (formato que a API devolve) em cues com segundos. */
function parseSrt(srt: string): TranscriptCue[] {
  const cues: TranscriptCue[] = []
  const tempo = (t: string) => {
    const m = t.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/)
    if (!m) return 0
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000
  }

  for (const bloco of srt.split(/\r?\n\r?\n/)) {
    const linhas = bloco.split(/\r?\n/).filter((l) => l.trim())
    if (linhas.length < 2) continue
    const linhaTempo = linhas.find((l) => l.includes('-->'))
    if (!linhaTempo) continue

    const [de, ate] = linhaTempo.split('-->')
    const inicio = tempo(de)
    const fim = tempo(ate)
    const texto = linhas
      .slice(linhas.indexOf(linhaTempo) + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (texto) cues.push({ text: texto, start: inicio, duration: Math.max(0, fim - inicio) })
  }
  return cues
}

async function viaDataApi(videoId: string): Promise<TranscriptCue[]> {
  const token = await accessTokenDoDono()
  if (!token) return []

  const auth = { Authorization: `Bearer ${token}` }

  // lista as faixas de legenda do vídeo
  const lista = await fetch(
    `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}`,
    { headers: auth },
  )
  if (!lista.ok) {
    const corpo = await lista.text()
    if (ehErroDeCota(corpo)) {
      throw new AppError(mensagemDeCota(), 429, 'youtube_quota')
    }
    throw new AppError(
      `captions.list falhou para ${videoId}: ${corpo.slice(0, 200)}`,
      502,
      'captions_list_failed',
    )
  }

  const faixas: any[] = (await lista.json()).items ?? []
  if (faixas.length === 0) return []

  // preferência: pt-BR manual > pt manual > pt-BR automática > qualquer pt > primeira
  const pontuar = (f: any) => {
    const lang = String(f.snippet?.language ?? '')
    const auto = f.snippet?.trackKind === 'ASR'
    let p = 0
    if (lang.startsWith('pt')) p += 4
    if (lang === 'pt-BR') p += 1
    if (!auto) p += 2
    return p
  }
  const escolhida = [...faixas].sort((a, b) => pontuar(b) - pontuar(a))[0]

  const download = await fetch(
    `https://www.googleapis.com/youtube/v3/captions/${escolhida.id}?tfmt=srt`,
    { headers: auth },
  )
  if (!download.ok) {
    const corpo = await download.text()
    if (ehErroDeCota(corpo)) {
      throw new AppError(mensagemDeCota(), 429, 'youtube_quota')
    }
    throw new AppError(
      `captions.download falhou para ${videoId}: ${corpo.slice(0, 200)}. ` +
        'A conta OAuth precisa ser a DONA do canal.',
      502,
      'captions_download_failed',
    )
  }

  return parseSrt(await download.text())
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
    ['data-api', () => viaDataApi(videoId)],
    ['timedtext', () => viaTimedText(videoId)],
    ['apify', () => viaApify(videoId)],
    ['whisper', () => viaWhisper(videoId)],
  ]

  const falhas: string[] = []
  let houveErroReal = false

  for (const [nome, executar] of estrategias) {
    try {
      const cues = await executar()
      if (cues.length > 0) return cues
      falhas.push(`${nome}: sem legenda`)
    } catch (error) {
      // Cota estourada não é "essa estratégia não serve": nenhuma das outras
      // vai resolver, e insistir só gera um log gigante. Aborta a cadeia.
      if (error instanceof AppError && error.code === 'youtube_quota') throw error
      houveErroReal = true
      falhas.push(`${nome}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Duas saídas diferentes, e a diferença é o que o painel mostra à equipe.
  //
  // Nenhuma estratégia ACHOU texto, mas nenhuma QUEBROU: o vídeo simplesmente
  // não tem legenda no YouTube. É conteúdo, não defeito, e retentar hoje ou
  // daqui a um mês dá no mesmo (só volta a valer se alguém ligar a legenda lá).
  if (!houveErroReal) {
    throw new AppError(
      `O YouTube não tem legenda para ${videoId}: nenhuma das quatro estratégias encontrou texto.`,
      422,
      'no_transcript',
    )
  }

  // Alguma estratégia estourou de verdade (credencial, rede, serviço fora).
  // Isso é para investigar, e aqui a dica de configuração vale a pena.
  throw new AppError(
    `Não foi possível obter a transcrição de ${videoId}. Tentativas: ${falhas.join(' | ')}. ` +
      'O YouTube bloqueia acesso anônimo a legendas vindo de datacenter, então o caminho ' +
      'principal é o OAuth do dono do canal: confira YOUTUBE_OAUTH_CLIENT_ID, ' +
      'YOUTUBE_OAUTH_CLIENT_SECRET e YOUTUBE_OAUTH_REFRESH_TOKEN. Alternativa paga: APIFY_TOKEN.',
    502,
    'transcript_failed',
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
