import { Link } from 'react-router-dom'
import { Clock, PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ROUTES } from '@/lib/routes'
import { formatScore, formatTimestamp, thumbnailUrl } from '@/lib/format'
import type { SearchHit } from '@/types/search'

/**
 * Card de recomendação: vídeo + minutagem exata + trecho do insight.
 * O botão leva para /video/:id já posicionado no segundo certo, que é a
 * entrega central do produto.
 */
export function ResultCard({ hit }: { hit: SearchHit }) {
  const minuto = formatTimestamp(hit.start_seconds)
  const destino = `${ROUTES.video(hit.video_id)}?t=${hit.start_seconds}&s=${hit.segment_id}`

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="flex flex-col gap-4 p-0 sm:flex-row">
        <Link
          to={destino}
          className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted sm:aspect-auto sm:h-auto sm:w-56"
          aria-label={`Abrir ${hit.title} no minuto ${minuto}`}
        >
          <img
            src={thumbnailUrl(hit.youtube_video_id, hit.thumbnail_url)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {minuto}
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:py-4 sm:pl-0 sm:pr-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Clock className="size-3" />
              minuto {minuto}
            </Badge>
            <Badge variant="outline">{formatScore(hit.similarity_score)} de relevância</Badge>
          </div>

          <h3 className="text-balance font-semibold leading-snug">
            <Link to={destino} className="hover:underline">
              {hit.title}
            </Link>
          </h3>

          <p className="line-clamp-3 text-sm text-muted-foreground">“{hit.segment_text}”</p>

          <div className="mt-auto pt-1">
            <Button asChild size="sm">
              <Link to={destino}>
                <PlayCircle />
                Ver no minuto {minuto}
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
