import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { friendlyAuthError } from '@/lib/auth-errors'
import { ROUTES } from '@/lib/routes'
import { supabase } from '@/lib/supabase'

/**
 * /redefinir-senha
 * Destino do link "esqueci minha senha".
 *
 * Precisa ser uma rota própria: o link do e-mail cria a sessão e, quando ele
 * apontava para /login, a página detectava "autenticado" e mandava direto para
 * /busca. A pessoa nunca via a tela de digitar a senha nova, e a senha antiga
 * continuava valendo (e continuava esquecida).
 */
export function RedefinirSenhaPage() {
  const navigate = useNavigate()
  const [temSessao, setTemSessao] = useState<boolean | null>(null)
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    // O link de recuperação chega com a sessão no fragmento da URL; o cliente
    // do Supabase processa sozinho. Aqui só conferimos se deu certo.
    void supabase.auth.getSession().then(({ data }) => setTemSessao(Boolean(data.session)))
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY' || evento === 'SIGNED_IN') setTemSessao(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro(null)

    if (senha.length < 8) {
      setErro('A senha precisa ter no mínimo 8 caracteres.')
      return
    }
    if (senha !== confirmacao) {
      setErro('As duas senhas não são iguais.')
      return
    }

    setSalvando(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error
      toast.success('Senha alterada. Você já está dentro.')
      navigate(ROUTES.busca, { replace: true })
    } catch (error) {
      setErro(friendlyAuthError(error))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-16 sm:px-8">
      <Card>
        <CardHeader>
          <KeyRound className="size-6 text-muted-foreground" aria-hidden="true" />
          <CardTitle className="text-2xl">Escolher senha nova</CardTitle>
          <CardDescription>
            {temSessao === false
              ? 'Este link expirou ou já foi usado.'
              : 'Defina a senha que você vai usar daqui para a frente.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {temSessao === false ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Peça um link novo na tela de login, em "Esqueci minha senha". O link vale por
                tempo limitado e só funciona uma vez.
              </p>
              <Button asChild>
                <Link to={ROUTES.login}>Ir para o login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {erro && (
                <Alert variant="destructive" role="alert">
                  <AlertCircle />
                  <AlertTitle>Não deu para salvar</AlertTitle>
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-2">
                <Label htmlFor="senha">Senha nova</Label>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo de 8 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  disabled={salvando || temSessao === null}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmacao">Repita a senha</Label>
                <Input
                  id="confirmacao"
                  type="password"
                  autoComplete="new-password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  disabled={salvando || temSessao === null}
                />
              </div>
              <Button type="submit" className="w-full" disabled={salvando || temSessao === null}>
                {salvando && <Loader2 className="animate-spin" />}
                {salvando ? 'Salvando...' : 'Salvar senha nova'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
