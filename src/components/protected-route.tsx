import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { ROUTES } from '@/lib/routes'

function AuthLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-16 sm:px-8">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-full max-w-md" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

/**
 * Regra crítica do PROCESSO: visitante sem cadastro não vê recomendação.
 * Sem sessão -> /cadastro. `staffOnly` reforça no frontend o que o RLS
 * (is_concer_staff) já garante no banco.
 */
export function ProtectedRoute({ staffOnly = false }: { staffOnly?: boolean }) {
  const { isAuthenticated, isStaff, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AuthLoading />

  if (!isAuthenticated) {
    // pathname + search: o deep link dos e-mails da régua carrega ?t= e ?s=
    // (o minuto exato). Só o pathname jogava fora justamente a promessa
    // que fez a pessoa clicar.
    return (
      <Navigate
        to={ROUTES.cadastro}
        state={{ from: location.pathname + location.search }}
        replace
      />
    )
  }

  if (staffOnly && !isStaff) {
    return <Navigate to={ROUTES.busca} replace />
  }

  return <Outlet />
}
