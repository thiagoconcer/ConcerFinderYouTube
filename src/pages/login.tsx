import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/use-auth'
import { friendlyAuthError } from '@/lib/auth-errors'
import { ROUTES } from '@/lib/routes'
import { supabase } from '@/lib/supabase'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type Mode = 'password' | 'magic-link'

export function LoginPage() {
  const { isAuthenticated, loading, signInWithPassword, signInWithMagicLink } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Para onde a pessoa ia quando caiu no login (deep link de e-mail, por
  // exemplo). Sem isso, o minuto exato prometido no e-mail evaporava aqui.
  const destino = (location.state as { from?: string } | null)?.from ?? ROUTES.busca

  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  if (!loading && isAuthenticated) {
    return <Navigate to={destino} replace />
  }

  function switchMode(next: Mode) {
    setMode(next)
    setFormError(null)
    setMagicLinkSent(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!EMAIL_PATTERN.test(email.trim())) {
      setFormError('Informe um e-mail válido.')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'magic-link') {
        await signInWithMagicLink(email)
        setMagicLinkSent(true)
        return
      }

      if (password.length === 0) {
        setFormError('Digite sua senha ou entre com link mágico.')
        return
      }

      await signInWithPassword(email, password)
      navigate(destino, { replace: true })
    } catch (error) {
      setFormError(friendlyAuthError(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotPassword() {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setFormError('Digite seu e-mail acima para receber o link de redefinição.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        // Rota própria: cair no /login com sessão criada redirecionava para
        // /busca e a pessoa nunca via a tela de digitar a senha nova.
        redirectTo: `${window.location.origin}${ROUTES.redefinirSenha}`,
      })
      if (error) throw error
      toast.success('Enviamos um link de redefinição de senha para o seu e-mail.')
    } catch (error) {
      setFormError(friendlyAuthError(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (magicLinkSent) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-16 sm:px-8">
        <Card>
          <CardHeader>
            <MailCheck className="size-6 text-muted-foreground" aria-hidden="true" />
            <CardTitle>Enviamos um link para seu e-mail</CardTitle>
            <CardDescription>
              Abra a mensagem enviada para <strong>{email}</strong> e clique no link para entrar.
              O link vale por tempo limitado.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {/* Antes só voltava ao formulário: a pessoa achava que reenviou
                e ficava olhando a caixa de entrada. */}
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => {
                setSubmitting(true)
                signInWithMagicLink(email)
                  .then(() => toast.success('Link reenviado. Confira também o spam.'))
                  .catch((error) => toast.error(friendlyAuthError(error)))
                  .finally(() => setSubmitting(false))
              }}
            >
              {submitting ? 'Reenviando...' : 'Reenviar link'}
            </Button>
            <Button variant="ghost" onClick={() => switchMode('password')}>
              Entrar com senha
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-16 sm:px-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Entrar</CardTitle>
          <CardDescription>
            {mode === 'password'
              ? 'Acesse sua conta para buscar insights por dor de vendas.'
              : 'Informe seu e-mail e enviaremos um link de acesso, sem senha.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Não foi possível entrar</AlertTitle>
                <AlertDescription>
                  {formError}
                  {formError.includes('já tem cadastro') ? null : (
                    <Link
                      to={ROUTES.cadastro}
                      className="font-medium underline underline-offset-4"
                    >
                      Ainda não tenho conta
                    </Link>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="voce@empresa.com.br"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
              />
            </div>

            {mode === 'password' && (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <button
                    type="button"
                    onClick={() => void handleForgotPassword()}
                    disabled={submitting}
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              {submitting
                ? mode === 'password'
                  ? 'Entrando...'
                  : 'Enviando link...'
                : mode === 'password'
                  ? 'Entrar'
                  : 'Enviar link mágico'}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">ou</span>
            <Separator className="flex-1" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={submitting}
            onClick={() => switchMode(mode === 'password' ? 'magic-link' : 'password')}
          >
            {mode === 'password' ? 'Entrar com link mágico' : 'Entrar com e-mail e senha'}
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ainda não tem conta?{' '}
            <Link
              to={ROUTES.cadastro}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Criar conta grátis
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
