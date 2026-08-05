import { Link } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PagePlaceholderProps {
  title: string
  route: string
  phase: string
  description: string
  /** o que esta tela vai entregar quando for construída (docs/PAGINAS.md) */
  planned: string[]
  backTo?: { label: string; to: string }
}

/**
 * Placeholder das telas que ainda não entraram no escopo da fase atual.
 * A rota já existe e navega, a funcionalidade chega na fase indicada.
 */
export function PagePlaceholder({
  title,
  route,
  phase,
  description,
  planned,
  backTo,
}: PagePlaceholderProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{phase}</Badge>
            <code className="font-mono text-xs text-muted-foreground">{route}</code>
          </div>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Construction className="size-5 text-muted-foreground" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium">O que esta tela vai entregar:</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {planned.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true" className="text-muted-foreground/60">
                    •
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {backTo ? (
            <Button asChild variant="outline">
              <Link to={backTo.to}>{backTo.label}</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
