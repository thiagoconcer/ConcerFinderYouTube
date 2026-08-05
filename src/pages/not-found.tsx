import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'

export function NotFoundPage() {
  return (
    <div className="mx-auto w-full max-w-md px-5 py-24 text-center sm:px-8">
      <p className="text-sm font-medium text-muted-foreground">Erro 404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Página não encontrada</h1>
      <p className="mt-3 text-muted-foreground">
        O endereço que você acessou não existe no ConcerFinder.
      </p>
      <Button asChild className="mt-8">
        <Link to={ROUTES.landing}>Voltar para o início</Link>
      </Button>
    </div>
  )
}
