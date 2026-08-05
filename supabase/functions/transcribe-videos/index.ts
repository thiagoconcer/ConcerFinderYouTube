import { AppError, handler, json } from '../_shared/http.ts'
import { finishRun, requireStaffOrService, serviceClient, startRun } from '../_shared/supabase.ts'
import { buildSegments, fetchTranscript } from '../_shared/transcript.ts'
import { detectTopics } from '../_shared/topics.ts'

/**
 * transcribe-videos
 * Pega vídeos `pending`, obtém a transcrição com timestamps e quebra em
 * `video_segments`. É a etapa que gera a minutagem exata do produto.
 * Chamada pelo pg_cron ou pelo painel (reprocessar um vídeo específico).
 */

interface Body {
  video_id?: string
  batch_size?: number
}

Deno.serve(handler(async (req) => {
  await requireStaffOrService(req)

  const body: Body = await req.json().catch(() => ({}))
  const batchSize = Math.min(Math.max(body.batch_size ?? 10, 1), 50)

  const db = serviceClient()
  const runId = await startRun(db, 'transcribe')

  try {
    // 1. seleciona o lote
    let query = db
      .from('videos')
      .select('id, youtube_video_id, title')
      .order('published_at', { ascending: false, nullsFirst: false })

    query = body.video_id
      ? query.eq('id', body.video_id)
      : query.eq('transcription_status', 'pending').limit(batchSize)

    const { data: videos, error } = await query
    if (error) throw new AppError(`Falha ao listar vídeos: ${error.message}`, 500)

    if (!videos || videos.length === 0) {
      await finishRun(db, runId, { status: 'completed', videos_processed: 0 })
      return json({ run_id: runId, videos_transcribed: 0, segments_created: 0, status: 'completed' })
    }

    // 2. marca como `transcribing` antes de começar, evitando corrida entre
    //    duas execuções do cron pegarem o mesmo vídeo
    await db
      .from('videos')
      .update({ transcription_status: 'transcribing' })
      .in('id', videos.map((v) => v.id))

    let transcritos = 0
    let segmentosCriados = 0
    const falhas: string[] = []

    for (const video of videos) {
      try {
        const cues = await fetchTranscript(video.youtube_video_id)
        const segmentos = buildSegments(cues)

        if (segmentos.length === 0) {
          throw new AppError(`Transcrição vazia para ${video.youtube_video_id}.`, 422, 'empty_transcript')
        }

        // reprocessamento: limpa os segmentos antigos do vídeo
        await db.from('video_segments').delete().eq('video_id', video.id)

        const linhas = segmentos.map((s) => ({
          video_id: video.id,
          segment_text: s.segment_text,
          start_seconds: s.start_seconds,
          end_seconds: s.end_seconds,
          topic_tags: detectTopics(s.segment_text, 4),
        }))

        for (let i = 0; i < linhas.length; i += 200) {
          const { error: insErr } = await db.from('video_segments').insert(linhas.slice(i, i + 200))
          if (insErr) throw new AppError(`Falha ao gravar segmentos: ${insErr.message}`, 500)
        }

        await db
          .from('videos')
          .update({ transcription_status: 'transcribed' })
          .eq('id', video.id)

        transcritos++
        segmentosCriados += linhas.length
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : String(error)
        falhas.push(`${video.youtube_video_id}: ${mensagem}`)
        await db.from('videos').update({ transcription_status: 'failed' }).eq('id', video.id)
      }
    }

    await finishRun(db, runId, {
      status: falhas.length === videos.length ? 'failed' : 'completed',
      videos_processed: transcritos,
      error_message: falhas.length > 0 ? falhas.join(' | ').slice(0, 1000) : undefined,
    })

    return json({
      run_id: runId,
      videos_transcribed: transcritos,
      segments_created: segmentosCriados,
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
