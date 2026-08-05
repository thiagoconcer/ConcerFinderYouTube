import { Link } from 'react-router-dom'
import { ROUTES } from '@/lib/routes'

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          ConcerFinder, busca inteligente no acervo do canal do{' '}
          <span className="font-medium text-foreground">Thiago Concer</span>.
        </p>
        <nav className="flex items-center gap-4" aria-label="Links do rodapé">
          <Link to={ROUTES.login} className="transition-colors hover:text-foreground">
            Já tenho conta
          </Link>
          <Link to={ROUTES.cadastro} className="transition-colors hover:text-foreground">
            Criar conta grátis
          </Link>
        </nav>
      </div>
    </footer>
  )
}
