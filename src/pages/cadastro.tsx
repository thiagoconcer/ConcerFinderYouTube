import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2, MailCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { friendlyAuthError } from '@/lib/auth-errors'
import { ROUTES } from '@/lib/routes'
import { supabase } from '@/lib/supabase'
import { CARGO_LABELS, CARGO_PARA_PERFIL } from '@/types/database'
import type { Cargo } from '@/types/database'

type FieldErrors = Partial<
  Record<'fullName' | 'email' | 'whatsapp' | 'cargo' | 'password', string>
>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function CadastroPage() {
  const { isAuthenticated, loading, signUp } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [cargo, setCargo] = useState<Cargo | ''>('')
  const [password, setPassword] = useState('')

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  if (!loading && isAuthenticated) {
    return <Navigate to={ROUTES.busca} replace />
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {}

    if (fullName.trim().length < 3) {
      errors.fullName = 'Informe seu nome completo.'
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = 'Informe um e-mail válido.'
    }
    const digits = whatsapp.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 13) {
      errors.whatsapp = 'Informe o WhatsApp com DDD (ex.: 11 98888-7777).'
    }
    if (!cargo) {
      errors.cargo = 'Selecione o seu cargo.'
    }
    if (password.length < 6) {
      errors.password = 'A senha precisa ter no mínimo 6 caracteres.'
    }

    return errors
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const { needsEmailConfirmation } = await signUp({
        fullName,
        email,
        whatsapp,
        cargo: cargo as Cargo,
        commercialRole: CARGO_PARA_PERFIL[cargo as Cargo],
        password,
      })

      if (needsEmailConfirmation) {
        setAwaitingConfirmation(true)
        return
      }

      // Gera o lead e dispara a régua de nutrição.
      // Regra do PAGINAS.md: se a nutrição falhar, o usuário é liberado do
      // mesmo jeito (o lead fica com nurture_status='failed' para a equipe
      // reprocessar), então a falha aqui não bloqueia a busca.
      try {
        const { error } = await supabase.functions.invoke('register-lead', {
          body: {
            full_name: fullName.trim(),
            email: email.trim(),
            whatsapp: whatsapp.trim(),
            cargo,
          },
        })
        if (error) console.warn('register-lead falhou, cadastro segue liberado:', error)
      } catch (error) {
        console.warn('register-lead indisponível, cadastro segue liberado:', error)
      }

      navigate(ROUTES.busca, { replace: true })
    } catch (error) {
      setFormError(friendlyAuthError(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (awaitingConfirmation) {
    return (
      <div className="mx-auto w-full max-w-lg px-5 py-16 sm:px-8">
        <Card>
          <CardHeader>
            <MailCheck className="size-6 text-muted-foreground" aria-hidden="true" />
            <CardTitle>Confirme seu e-mail</CardTitle>
            <CardDescription>
              Enviamos um link de confirmação para <strong>{email}</strong>. Clique nele para
              ativar a conta e liberar a busca.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to={ROUTES.login}>Ir para o login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-16 sm:px-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Criar conta grátis</CardTitle>
          <CardDescription>
            O cadastro é gratuito e libera a busca imediatamente. Descreva sua dor de vendas e
            veja em quais vídeos, e em quais minutos, o Concer resolve.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Não foi possível criar sua conta</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                placeholder="Como você quer ser chamado"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.fullName)}
              />
              {fieldErrors.fullName && (
                <p className="text-sm text-destructive">{fieldErrors.fullName}</p>
              )}
            </div>

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
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 98888-7777"
                value={whatsapp}
                onChange={(event) => setWhatsapp(event.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.whatsapp)}
              />
              {fieldErrors.whatsapp && (
                <p className="text-sm text-destructive">{fieldErrors.whatsapp}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Select
                value={cargo}
                onValueChange={(value) => setCargo(value as Cargo)}
                disabled={submitting}
              >
                <SelectTrigger id="cargo" className="w-full" aria-invalid={Boolean(fieldErrors.cargo)}>
                  <SelectValue placeholder="Selecione o seu cargo" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CARGO_LABELS) as Cargo[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CARGO_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.cargo && <p className="text-sm text-destructive">{fieldErrors.cargo}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo de 6 caracteres"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.password)}
              />
              {fieldErrors.password && (
                <p className="text-sm text-destructive">{fieldErrors.password}</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Ao criar a conta você concorda em receber conteúdos sobre vendas por e-mail e
              WhatsApp. Seus dados são usados apenas para essa comunicação e você pode pedir a
              remoção quando quiser (LGPD).
            </p>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              {submitting ? 'Criando conta...' : 'Criar conta e buscar'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Já tem conta?{' '}
              <Link to={ROUTES.login} className="font-medium text-foreground underline-offset-4 hover:underline">
                Entrar
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
