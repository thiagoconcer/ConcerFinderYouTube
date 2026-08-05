import {
  AppError,
  ehErroDeCota,
  fetchJson,
  handler,
  json,
  mensagemDeCota,
  optionalSecret,
  requireSecret,
} from '../_shared/http.ts'
import { finishRun, requireStaffOrService, serviceClient, startRun } from '../_shared/supabase.ts'

/**
 * scrape-youtube-channel
 * Captura a lista de vídeos do canal do Concer (YouTube Data API v3) e faz
 * upsert em `videos`. Chamada pelo painel /admin/conteudo (staff) ou pelo
 * pg_cron diário (service_role). Registra tudo em ingestion_runs.
 */

interface Body {
  channel_id?: string
  force_full?: boolean
  max_videos?: number
}

interface VideoUpsert {
  youtube_video_id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  published_at: string | null
  duration_seconds?: number | null
}

/** ISO 8601 do YouTube (PT1H2M3S) para segundos. */
function parseDuration(iso: string | undefined): number | null {
  if (!iso) return null
  const m = iso.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!m) return null
  const [, d, h, min, s] = m
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0)
}

async function listarVideosDoCanal(
  apiKey: string,
  channelId: string,
  maxVideos: number,
): Promise<VideoUpsert[]> {
  // 1. o canal expõe a playlist "uploads" com todos os vídeos publicados
  const canal = await fetchJson(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`,
    {},
    'YouTube Data API (channels)',
  )
  const uploads = canal?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) {
    throw new AppError(
      `Canal ${channelId} não encontrado na YouTube Data API. Confira YOUTUBE_CHANNEL_ID.`,
      404,
      'channel_not_found',
    )
  }

  // 2. pagina a playlist até maxVideos
  const videos: VideoUpsert[] = []
  let pageToken: string | undefined
  while (videos.length < maxVideos) {
    const page: any = await fetchJson(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploads}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}&key=${apiKey}`,
      {},
      'YouTube Data API (playlistItems)',
    )
    for (const item of page.items ?? []) {
      const snippet = item.snippet
      const videoId = item.contentDetails?.videoId
      if (!videoId || snippet?.title === 'Private video' || snippet?.title === 'Deleted video') {
        continue
      }
      videos.push({
        youtube_video_id: videoId,
        title: snippet.title,
        description: snippet.description || null,
        thumbnail_url:
          snippet.thumbnails?.maxres?.url ??
          snippet.thumbnails?.high?.url ??
          snippet.thumbnails?.default?.url ??
          null,
        published_at: item.contentDetails?.videoPublishedAt ?? snippet.publishedAt ?? null,
      })
      if (videos.length >= maxVideos) break
    }
    pageToken = page.nextPageToken
    if (!pageToken) break
  }

  // 3. enriquece com a duração (endpoint videos, 50 ids por chamada)
  for (let i = 0; i < videos.length; i += 50) {
    const lote = videos.slice(i, i + 50)
    const detalhes: any = await fetchJson(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${lote.map((v) => v.youtube_video_id).join(',')}&key=${apiKey}`,
      {},
      'YouTube Data API (videos)',
    )
    const porId = new Map<string, number | null>(
      (detalhes.items ?? []).map((it: any) => [it.id, parseDuration(it.contentDetails?.duration)]),
    )
    for (const v of lote) v.duration_seconds = porId.get(v.youtube_video_id) ?? null
  }

  return videos
}

Deno.serve(handler(async (req) => {
  await requireStaffOrService(req)

  const body: Body = await req.json().catch(() => ({}))
  const apiKey = requireSecret('YOUTUBE_API_KEY')
  const channelId =
    body.channel_id ?? optionalSecret('YOUTUBE_CHANNEL_ID') ??
    (() => {
      throw new AppError(
        'Defina YOUTUBE_CHANNEL_ID nos Secrets ou envie channel_id no corpo da chamada.',
        503,
        'missing_secret',
      )
    })()
  const maxVideos = Math.min(Math.max(body.max_videos ?? 500, 1), 2000)

  const db = serviceClient()
  const runId = await startRun(db, 'scrape')

  try {
    const encontrados = await listarVideosDoCanal(apiKey, channelId, maxVideos)

    // quais já existem, para contar novos e preservar o status de quem já foi indexado
    const { data: existentes } = await db
      .from('videos')
      .select('youtube_video_id, transcription_status')
    const statusPorId = new Map(
      (existentes ?? []).map((v) => [v.youtube_video_id, v.transcription_status]),
    )

    const paraGravar = encontrados
      .filter((v) => {
        if (body.force_full) return true
        // não reprocessa quem já está indexado, só atualiza metadados de quem não está
        return statusPorId.get(v.youtube_video_id) !== 'indexed'
      })
      .map((v) => ({
        ...v,
        transcription_status: body.force_full
          ? 'pending'
          : (statusPorId.get(v.youtube_video_id) ?? 'pending'),
      }))

    let gravados = 0
    for (let i = 0; i < paraGravar.length; i += 200) {
      const lote = paraGravar.slice(i, i + 200)
      const { error } = await db.from('videos').upsert(lote, { onConflict: 'youtube_video_id' })
      if (error) throw new AppError(`Falha ao gravar vídeos: ${error.message}`, 500)
      gravados += lote.length
    }

    const novos = encontrados.filter((v) => !statusPorId.has(v.youtube_video_id)).length
    await finishRun(db, runId, { status: 'completed', videos_processed: gravados })

    return json({
      run_id: runId,
      videos_found: encontrados.length,
      videos_new: novos,
      videos_upserted: gravados,
      status: 'completed',
    })
  } catch (error) {
    const cru = error instanceof Error ? error.message : String(error)
    const cota = ehErroDeCota(cru)
    const mensagem = cota ? mensagemDeCota() : cru

    await finishRun(db, runId, { status: 'failed', error_message: mensagem.slice(0, 1000) })

    // A mensagem tratada vai também para o chamador, não só para o log:
    // é ela que o painel mostra.
    if (cota) {
      return json({ run_id: runId, status: 'failed', error: mensagem, quota_exhausted: true }, 429)
    }
    if (error instanceof AppError) {
      return json({ run_id: runId, status: 'failed', error: mensagem }, error.status)
    }
    throw error
  }
}))
