import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Menu, User as UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuth } from '@/hooks/use-auth'
import { friendlyAuthError } from '@/lib/auth-errors'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  to: string
}

export function SiteHeader() {
  const { isAuthenticated, isStaff, profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems: NavItem[] = isAuthenticated
    ? [
        { label: 'Busca', to: ROUTES.busca },
        { label: 'Histórico', to: ROUTES.historico },
        ...(isStaff
          ? [
              { label: 'Dashboard', to: ROUTES.adminDashboard },
              { label: 'Leads', to: ROUTES.adminLeads },
              { label: 'Conteúdo', to: ROUTES.adminConteudo },
            ]
          : []),
      ]
    : []

  const displayName = profile?.full_name || user?.email || 'Minha conta'

  async function handleSignOut() {
    try {
      await signOut()
      setMobileOpen(false)
      toast.success('Você saiu da sua conta.')
      navigate(ROUTES.landing)
    } catch (error) {
      toast.error(friendlyAuthError(error))
    }
  }

  // Header sticky com vidro fosco, como o da LP: 68px de altura, blur 16px
  return (
    <header className="sticky top-0 z-50 h-[68px] w-full border-b bg-background/85 backdrop-blur-[16px] supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-full w-full max-w-[1180px] items-center gap-4 px-5 sm:px-8">
        <Link
          to={isAuthenticated ? ROUTES.busca : ROUTES.landing}
          className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="ConcerFinder, página inicial"
        >
          <Logo />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Navegação principal">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === ROUTES.busca}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="max-w-[12rem]">
                  <UserIcon />
                  <span className="truncate">{displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {user?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleSignOut()}>
                  <LogOut />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant="ghost" size="sm">
                <Link to={ROUTES.login}>Entrar</Link>
              </Button>
              <Button asChild size="sm">
                <Link to={ROUTES.cadastro}>Criar conta grátis</Link>
              </Button>
            </div>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(isAuthenticated ? 'md:hidden' : 'sm:hidden')}
                aria-label="Abrir menu"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle asChild>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label="Navegação principal (mobile)">
                {isAuthenticated ? (
                  navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === ROUTES.busca}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))
                ) : (
                  <>
                    <Button asChild onClick={() => setMobileOpen(false)}>
                      <Link to={ROUTES.cadastro}>Criar conta grátis</Link>
                    </Button>
                    <Button asChild variant="ghost" onClick={() => setMobileOpen(false)}>
                      <Link to={ROUTES.login}>Já tenho conta</Link>
                    </Button>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
