import { Link } from 'react-router-dom'
import { Clock, PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ROUTES } from '@/lib/routes'
import { formatDuration, formatScore, formatTimestamp, thumbnailUrl } from '@/lib/format'
import type { SearchHit } from '@/types/search'

/**
 * Similaridade de cosseno em rótulo. "52% de relevância" fazia um resultado
 * ótimo parecer meia-boca para quem não sabe que 0,5 de cosseno é alto; a
 * régua vem da calibração do painel (>= 0,60 responde bem, >= 0,45 tangencia).
 */
function rotuloDeRelevancia(score: number): string {
  if (score >= 0.6) return 'Muito relevante'
  if (score >= 0.45) return 'Relevante'
  return 'Relacionado'
}


/**
 * Card de recomendação: vídeo + minutagem exata + trecho do insight.
 * O botão leva para /video/:id já posicionado no segundo certo, que é a
 * entrega central do produto.
 */
export function ResultCard({ hit }: { hit: SearchHit }) {
  const minuto = formatTimestamp(hit.start_seconds)
  const duracao = formatDuration(hit.start_seconds, hit.end_seconds)
  const destino = `${ROUTES.video(hit.video_id)}?t=${hit.start_seconds}&s=${hit.segment_id}`

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="flex flex-col gap-4 p-0 sm:flex-row">
        <Link
          to={destino}
          className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted sm:aspect-auto sm:h-auto sm:w-56"
          aria-label={
            duracao
              ? `Abrir ${hit.title}: insight de ${formatTimestamp(hit.start_seconds)} até ${formatTimestamp(hit.end_seconds ?? hit.start_seconds)}, ${duracao} de vídeo`
              : `Abrir ${hit.title} no minuto ${minuto}`
          }
        >
          <img
            src={thumbnailUrl(hit.youtube_video_id, hit.thumbnail_url)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
          {/* Na miniatura vai a DURAÇÃO, que é a convenção de vídeo e responde
              "quanto tempo isso vai me tomar". A minutagem tem lugar próprio
              logo abaixo, escrita por extenso. */}
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {duracao ?? minuto}
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:py-4 sm:pl-0 sm:pr-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Escrito por extenso: a seta sozinha ("19:51 → 20:36") e um "45 s"
                solto ao lado não diziam o que eram. Início e fim do insight é a
                informação central desta tela, não pode depender de dedução. */}
            <Badge variant="secondary" className="gap-1">
              <Clock className="size-3" />
              {hit.end_seconds && hit.end_seconds > hit.start_seconds
                ? `Insight de ${formatTimestamp(hit.start_seconds)} até ${formatTimestamp(hit.end_seconds)}`
                : `Insight no minuto ${minuto}`}
            </Badge>
            <Badge variant="outline" title={`${formatScore(hit.similarity_score)} de similaridade`}>
              {rotuloDeRelevancia(hit.similarity_score)}
            </Badge>
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
                {duracao ? `Assistir ${duracao} a partir de ${minuto}` : `Ver no minuto ${minuto}`}
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
