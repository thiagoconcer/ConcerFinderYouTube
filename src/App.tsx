import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/contexts/auth-context'
import { ThemeProvider } from '@/contexts/theme-context'
import { AdminAudienciaPage } from '@/pages/admin-audiencia'
import { AdminUsuariosPage } from '@/pages/admin-usuarios'
import { AdminLeadsPage } from '@/pages/admin-leads'
import { AdminLeadPerfilPage } from '@/pages/admin-lead-perfil'
import { RedefinirSenhaPage } from '@/pages/redefinir-senha'
import { capturarOrigem } from '@/lib/origem'

// Fora do componente, de proposito: precisa rodar antes da primeira
// navegacao interna, que troca a URL e levaria os UTM junto.
capturarOrigem()
import { AdminConteudoPage } from '@/pages/admin-conteudo'
import { BuscaHistoricoPage } from '@/pages/busca-historico'
import { BuscaPage } from '@/pages/busca'
import { CadastroPage } from '@/pages/cadastro'
import { LandingPage } from '@/pages/landing'
import { LoginPage } from '@/pages/login'
import { NotFoundPage } from '@/pages/not-found'
import { VideoDetailPage } from '@/pages/video-detail'
import { ROUTES } from '@/lib/routes'

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route element={<AppLayout />}>
              {/* Públicas */}
              <Route path={ROUTES.landing} element={<LandingPage />} />
              <Route path={ROUTES.cadastro} element={<CadastroPage />} />
              <Route path={ROUTES.login} element={<LoginPage />} />
              <Route path={ROUTES.redefinirSenha} element={<RedefinirSenhaPage />} />

              {/* Usuário cadastrado */}
              <Route element={<ProtectedRoute />}>
                <Route path={ROUTES.busca} element={<BuscaPage />} />
                <Route path={ROUTES.historico} element={<BuscaHistoricoPage />} />
                <Route path={ROUTES.video()} element={<VideoDetailPage />} />
              </Route>

              {/* Staff Concer (is_concer_staff) */}
              <Route element={<ProtectedRoute staffOnly />}>
                <Route path={ROUTES.adminConteudo} element={<AdminConteudoPage />} />
                <Route path={ROUTES.adminDashboard} element={<AdminAudienciaPage />} />
                <Route path={ROUTES.adminLeads} element={<AdminLeadsPage />} />
                <Route path={ROUTES.adminLeadPerfil()} element={<AdminLeadPerfilPage />} />
                <Route path={ROUTES.adminUsuarios} element={<AdminUsuariosPage />} />
                {/* Rota antiga: quem tiver o link salvo cai no dashboard. */}
                <Route
                  path={ROUTES.adminAudiencia}
                  element={<Navigate to={ROUTES.adminDashboard} replace />}
                />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
