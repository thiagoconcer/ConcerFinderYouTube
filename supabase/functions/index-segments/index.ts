import { AppError, handler, json } from '../_shared/http.ts'
import { finishRun, requireStaffOrService, serviceClient, startRun } from '../_shared/supabase.ts'
import { embedTexts } from '../_shared/ai.ts'

/**
 * index-segments
 * Gera o `embedding` de cada segmento transcrito. Só depois disso o vídeo
 * passa a `indexed` e entra na busca (a RPC search_videos ignora o resto).
 */

interface Body {
  video_id?: string
  batch_size?: number
}

const LOTE_EMBEDDING = 64 // quantos textos por chamada à API de embeddings

Deno.serve(handler(async (req) => {
  await requireStaffOrService(req)

  const body: Body = await req.json().catch(() => ({}))
  const batchSize = Math.min(Math.max(body.batch_size ?? 100, 1), 500)

  const db = serviceClient()
  const runId = await startRun(db, 'index')

  try {
    // 1. vídeos elegíveis: já transcritos (ou um vídeo específico)
    let vq = db.from('videos').select('id, youtube_video_id')
    vq = body.video_id ? vq.eq('id', body.video_id) : vq.eq('transcription_status', 'transcribed').limit(20)

    const { data: videos, error: vErr } = await vq
    if (vErr) throw new AppError(`Falha ao listar vídeos: ${vErr.message}`, 500)

    if (!videos || videos.length === 0) {
      await finishRun(db, runId, { status: 'completed', videos_processed: 0 })
      return json({ run_id: runId, segments_indexed: 0, videos_indexed: 0, status: 'completed' })
    }

    let segmentosIndexados = 0
    let videosIndexados = 0
    const falhas: string[] = []

    for (const video of videos) {
      try {
        // 2. segmentos sem embedding deste vídeo
        const { data: segmentos, error: sErr } = await db
          .from('video_segments')
          .select('id, segment_text')
          .eq('video_id', video.id)
          .is('embedding', null)
          .limit(batchSize)

        if (sErr) throw new AppError(`Falha ao listar segmentos: ${sErr.message}`, 500)

        const validos = (segmentos ?? []).filter((s) => s.segment_text?.trim().length > 0)

        for (let i = 0; i < validos.length; i += LOTE_EMBEDDING) {
          const lote = validos.slice(i, i + LOTE_EMBEDDING)
          const vetores = await embedTexts(lote.map((s) => s.segment_text))

          for (let j = 0; j < lote.length; j++) {
            const { error: upErr } = await db
              .from('video_segments')
              .update({ embedding: vetores[j] })
              .eq('id', lote[j].id)
            if (upErr) throw new AppError(`Falha ao gravar embedding: ${upErr.message}`, 500)
            segmentosIndexados++
          }
        }

        // 3. o vídeo só vira `indexed` quando não sobrar segmento sem embedding
        const { count: pendentes } = await db
          .from('video_segments')
          .select('id', { count: 'exact', head: true })
          .eq('video_id', video.id)
          .is('embedding', null)

        const { count: total } = await db
          .from('video_segments')
          .select('id', { count: 'exact', head: true })
          .eq('video_id', video.id)

        if ((pendentes ?? 0) === 0 && (total ?? 0) > 0) {
          await db
            .from('videos')
            .update({ transcription_status: 'indexed', indexed_at: new Date().toISOString() })
            .eq('id', video.id)
          videosIndexados++
        }
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : String(error)
        falhas.push(`${video.youtube_video_id}: ${mensagem}`)
        // não marca o vídeo como failed: os segmentos já vetorizados continuam
        // válidos e a próxima execução retoma de onde parou
      }
    }

    await finishRun(db, runId, {
      status: falhas.length === videos.length ? 'failed' : 'completed',
      videos_processed: videosIndexados,
      error_message: falhas.length > 0 ? falhas.join(' | ').slice(0, 1000) : undefined,
    })

    return json({
      run_id: runId,
      segments_indexed: segmentosIndexados,
      videos_indexed: videosIndexados,
      videos_failed: falhas.length,
      status: falhas.length === videos.length ? 'failed' : 'completed',
    })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error)
    await finishRun(db, runId, { status: 'failed', error_message: mensagem.slice(0, 1000) })
    if (error instanceof AppError) {
      return json({ run_id: runId, status: 'failed', error: error.message }, error.status)
    }
    throw error
  }
}))
