import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Search as SearchIcon, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/format'
import { COMMERCIAL_ROLE_LABELS } from '@/types/database'
import type { AppRole, CommercialRole } from '@/types/database'

/**
 * /admin/usuarios
 * Quem tem acesso ao painel, e como dar acesso a mais alguém.
 *
 * Existia como um bloco no fim do Dashboard, e ninguém achava: quem procura
 * "onde vejo os admins" não rola um painel de audiência até o pé. Virou página
 * com entrada no menu do usuário.
 *
 * A equipe aparece primeiro e sozinha, porque é a resposta da pergunta que traz
 * a pessoa aqui. Conceder acesso é uma busca no resto da base, e não uma lista
 * de 36 nomes para caçar: a lista completa só aparece quando se procura.
 *
 * A trava de verdade está no banco: `definir_papel` exige `is_concer_admin()` e
 * um trigger bloqueia UPDATE direto em `role`. Esta tela é a interface, não a
 * segurança.
 */

interface Pessoa {
  id: string
  full_name: string
  email: string
  commercial_role: string
  role: AppRole
  created_at: string
  buscas: number
}

const PAPEIS: Array<{ valor: AppRole; rotulo: string; descricao: string }> = [
  { valor: 'user', rotulo: 'Usuário', descricao: 'Só a busca, sem painel' },
  { valor: 'content_admin', rotulo: 'Conteúdo', descricao: 'Painéis e ingestão do canal' },
  { valor: 'audience_manager', rotulo: 'Audiência', descricao: 'Painéis e lista de leads' },
  { valor: 'admin', rotulo: 'Administrador', descricao: 'Tudo, incluindo dar acesso a outros' },
]

const COR: Record<AppRole, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  content_admin: 'secondary',
  audience_manager: 'secondary',
  user: 'outline',
}

export function AdminUsuariosPage() {
  const { profile } = useAuth()
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)

  const ehAdmin = profile?.role === 'admin'

  const carregar = useCallback(async () => {
    if (!ehAdmin) return
    const { data, error } = await supabase.rpc('get_equipe')
    if (error) {
      setPessoas([])
      return
    }
    setPessoas((data as unknown as Pessoa[]) ?? [])
  }, [ehAdmin])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const comAcesso = useMemo(
    () => (pessoas ?? []).filter((p) => p.role !== 'user'),
    [pessoas],
  )

  const encontradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (termo.length < 2) return []
    return (pessoas ?? [])
      .filter((p) => p.role === 'user')
      .filter(
        (p) =>
          p.full_name.toLowerCase().includes(termo) || p.email.toLowerCase().includes(termo),
      )
      .slice(0, 12)
  }, [pessoas, busca])

  async function alterarPapel(pessoa: Pessoa, novo: AppRole) {
    setSalvando(pessoa.id)
    const { error } = await supabase.rpc('definir_papel', {
      p_profile_id: pessoa.id,
      p_role: novo,
    })
    setSalvando(null)
    if (error) {
      toast.error(error.message)
      return
    }
    const rotulo = PAPEIS.find((p) => p.valor === novo)?.rotulo.toLowerCase()
    toast.success(`${pessoa.full_name} agora é ${rotulo}.`)
    void carregar()
  }

  function Linha({ pessoa }: { pessoa: Pessoa }) {
    const euMesmo = pessoa.id === profile?.id
    return (
      <li className="flex flex-wrap items-center justify-between gap-4 border-b py-3 last:border-0">
        <div className="min-w-0">
          <p className="font-medium">
            {pessoa.full_name}
            {euMesmo && (
              <Badge variant="outline" className="ml-2 text-xs">
                você
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{pessoa.email}</p>
          <p className="text-xs text-muted-foreground">
            {COMMERCIAL_ROLE_LABELS[pessoa.commercial_role as CommercialRole] ??
              pessoa.commercial_role}{' '}
            · desde {formatDate(pessoa.created_at)} · {pessoa.buscas} busca(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={COR[pessoa.role]}>
            {PAPEIS.find((p) => p.valor === pessoa.role)?.rotulo}
          </Badge>
          <Select
            value={pessoa.role}
            onValueChange={(v) => void alterarPapel(pessoa, v as AppRole)}
            disabled={salvando === pessoa.id || euMesmo}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAPEIS.map((p) => (
                <SelectItem key={p.valor} value={p.valor}>
                  <span className="flex flex-col items-start">
                    <span>{p.rotulo}</span>
                    <span className="text-xs text-muted-foreground">{p.descricao}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </li>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 py-10 sm:px-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Usuários e acessos</h1>
        <p className="mt-2 text-muted-foreground">
          Quem entra no painel, com qual papel, e como dar acesso a mais alguém.
        </p>
      </header>

      {!ehAdmin ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>Só o administrador altera acessos</AlertTitle>
          <AlertDescription>
            Você consegue usar os painéis, mas mudar o papel de alguém é exclusivo de quem tem
            papel de administrador. Peça a quem já é.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="size-4.5 text-primary" aria-hidden="true" />
                Quem tem acesso hoje ({comAcesso.length})
              </CardTitle>
              <CardDescription>
                Você não pode remover o próprio acesso, para a conta nunca ficar sem
                administrador.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pessoas === null ? (
                <Skeleton className="h-32 w-full" />
              ) : comAcesso.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ninguém além de você.</p>
              ) : (
                <ul>
                  {comAcesso.map((p) => (
                    <Linha key={p.id} pessoa={p} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dar acesso a alguém</CardTitle>
              <CardDescription>
                Procure pelo nome ou e-mail de quem já tem conta no ConcerFinder e escolha o
                papel. A pessoa precisa ter se cadastrado antes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome ou e-mail"
                  className="pl-9"
                  aria-label="Procurar pessoa para dar acesso"
                />
              </div>

              {busca.trim().length < 2 ? (
                <p className="text-sm text-muted-foreground">
                  Digite ao menos duas letras. A lista completa não aparece de propósito: são
                  dezenas de cadastros, e a busca é mais rápida que caçar um nome.
                </p>
              ) : encontradas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ninguém sem acesso com esse nome. Quem já tem acesso aparece no bloco acima.
                </p>
              ) : (
                <ul>
                  {encontradas.map((p) => (
                    <Linha key={p.id} pessoa={p} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
