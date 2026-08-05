import { cn } from '@/lib/utils'

/**
 * Marca do ConcerFinder: um "play" de vídeo dentro de uma lente de busca,
 * a ideia central do produto (encontrar o minuto exato dentro do vídeo).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('size-8 shrink-0', className)}
    >
      <circle
        cx="14"
        cy="14"
        r="10.5"
        className="stroke-primary"
        strokeWidth="2.5"
      />
      <path
        d="M11.75 10.4v7.2a.6.6 0 0 0 .92.51l5.6-3.6a.6.6 0 0 0 0-1.02l-5.6-3.6a.6.6 0 0 0-.92.51Z"
        className="fill-primary"
      />
      <path
        d="m22.2 22.2 6 6"
        className="stroke-primary"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight">
        Concer<span className="text-muted-foreground">Finder</span>
      </span>
    </span>
  )
}
