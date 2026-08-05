import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { ROUTES } from '@/lib/routes'
import {
  formatDate,
  formatDuration,
  formatTimestamp,
  topicLabel,
  youtubeEmbedUrl,
  youtubeUrl,
} from '@/lib/format'
import type { VideoDetail } from '@/types/search'

/**
 * /video/:id
 * Abre o vídeo já no minuto do insight. O `?t=` vem do card de resultado;
 * sem ele, começa do início com o aviso previsto na doc.
 */
export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const { user } = useAuth()

  const [detalhe, setDetalhe] = useState<VideoDetail | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [inicio, setInicio] = useState<number>(Number(params.get('t') ?? 0) || 0)

  const segmentoDestacado = params.get('s')

  const carregar = useCallback(async () => {
    if (!id) return
    setCarregando(true)
    setErro(null)
    try {
      const { data, error } = await supabase.rpc('get_video_detail', { p_video_id: id })
      if (error) throw error
      setDetalhe(data as unknown as VideoDetail)
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error)
      setErro(
        mensagem.includes('não encontrado') || mensagem.includes('P0002')
          ? 'Vídeo não encontrado ou indisponível.'
          : 'Não foi possível carregar o vídeo.',
      )
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /*
    Registra a visualização, uma vez por abertura da tela. É o que alimenta
    "trechos mais assistidos" no painel de audiência: `search_results` diz o
    que foi recomendado, isto diz o que a pessoa realmente abriu.
    Falha aqui não pode atrapalhar a leitura do vídeo, então é silenciosa.
  */
  const jaRegistrou = useRef<string | null>(null)
  useEffect(() => {
    if (!id || !user?.id || jaRegistrou.current === id) return
    jaRegistrou.current = id

    void supabase
      .from('video_views')
      .insert({
        profile_id: user.id,
        video_id: id,
        segment_id: params.get('s'),
        start_seconds: Number(params.get('t') ?? 0) || 0,
      })
      .then(({ error }) => {
        if (error) console.warn('não foi possível registrar a visualização:', error.message)
      })
  }, [id, user?.id, params])

  if (carregando) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 sm:px-8">
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (erro || !detalhe) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8">
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Vídeo indisponível</AlertTitle>
          <AlertDescription>
            {erro ?? 'Vídeo não encontrado.'}
            <Button asChild variant="outline" size="sm">
              <Link to={ROUTES.busca}>Voltar à busca</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const { video, segments } = detalhe
  const destacado = segments.find((s) => s.segment_id === segmentoDestacado) ?? segments[0]
  const outros = segments.filter((s) => s.segment_id !== destacado?.segment_id)

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to={ROUTES.busca}>
          <ArrowLeft />
          Voltar aos resultados
        </Link>
      </Button>

      {/* Player no minuto do insight */}
      <div className="aspect-video w-full overflow-hidden rounded-xl border bg-black">
        <iframe
          key={inicio}
          src={youtubeEmbedUrl(video.youtube_video_id, inicio)}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>

      <div className="mt-6 space-y-3">
        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          {video.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Publicado em {formatDate(video.published_at)}</span>
          {video.duration_seconds ? <span>Duração {formatTimestamp(video.duration_seconds)}</span> : null}
          <Button asChild variant="outline" size="sm">
            <a href={youtubeUrl(video.youtube_video_id, inicio)} target="_blank" rel="noreferrer">
              <ExternalLink />
              Abrir no YouTube
            </a>
          </Button>
        </div>
      </div>

      {/* Trecho destacado */}
      <section className="mt-8">
        {destacado ? (
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex flex-wrap items-center gap-2">
                {/* Por extenso, porque e a informacao central da tela: a
                    promessa do produto e a pessoa NAO assistir o video todo,
                    entao onde o insight acaba vale tanto quanto onde comeca. */}
                <Badge>
                  {destacado.end_seconds && destacado.end_seconds > destacado.start_seconds
                    ? `Insight de ${formatTimestamp(destacado.start_seconds)} até ${formatTimestamp(destacado.end_seconds)}`
                    : `Insight no minuto ${formatTimestamp(destacado.start_seconds)}`}
                </Badge>
                {formatDuration(destacado.start_seconds, destacado.end_seconds) && (
                  <Badge variant="outline">
                    {formatDuration(destacado.start_seconds, destacado.end_seconds)} de vídeo
                  </Badge>
                )}
                {(destacado.topic_tags ?? []).slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {topicLabel(tag)}
                  </Badge>
                ))}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                “{destacado.segment_text}”
              </p>
            </CardContent>
          </Card>
        ) : (
          <Alert>
            <AlertCircle />
            <AlertTitle>Sem timestamp específico para esta recomendação</AlertTitle>
            <AlertDescription>
              O vídeo está tocando desde o início. Faça uma busca descrevendo sua dor para receber a
              minutagem exata do insight.
            </AlertDescription>
          </Alert>
        )}
      </section>

      {/* Outros trechos do mesmo vídeo */}
      {outros.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Outros trechos relevantes deste vídeo</h2>
          <ul className="space-y-3">
            {outros.map((segmento) => (
              <li key={segmento.segment_id}>
                <button
                  type="button"
                  onClick={() => setInicio(segmento.start_seconds)}
                  className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent/50"
                >
                  <span className="mb-2 flex items-center gap-2">
                    <Badge variant="outline">
                      {segmento.end_seconds && segmento.end_seconds > segmento.start_seconds
                        ? `de ${formatTimestamp(segmento.start_seconds)} até ${formatTimestamp(segmento.end_seconds)}`
                        : `minuto ${formatTimestamp(segmento.start_seconds)}`}
                    </Badge>
                    {formatDuration(segmento.start_seconds, segmento.end_seconds) && (
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(segmento.start_seconds, segmento.end_seconds)} de vídeo
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-sm text-muted-foreground">
                    {segmento.segment_text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {video.description && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Descrição do vídeo</h2>
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {video.description.slice(0, 1200)}
          </p>
        </section>
      )}
    </div>
  )
}
