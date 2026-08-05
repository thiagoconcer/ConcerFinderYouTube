import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
 * Gestão de equipe: só o admin vê e só ele muda papéis.
 *
 * Existe para o admin não depender de SQL para promover alguém. A trava de
 * verdade está no banco (`definir_papel` valida `is_concer_admin()` e o
 * trigger bloqueia qualquer UPDATE direto em `role`); isto aqui é a interface.
 */

interface MembroEquipe {
  id: string
  full_name: string
  email: string
  commercial_role: string
  role: AppRole
  created_at: string
  buscas: number
}

const PAPEIS: Array<{ valor: AppRole; rotulo: string; descricao: string }> = [
  { valor: 'user', rotulo: 'Usuário', descricao: 'Só a busca' },
  { valor: 'content_admin', rotulo: 'Conteúdo', descricao: 'Painéis + ingestão' },
  { valor: 'audience_manager', rotulo: 'Audiência', descricao: 'Painéis + leads' },
  { valor: 'admin', rotulo: 'Administrador', descricao: 'Tudo + gestão de papéis' },
]

const COR_PAPEL: Record<AppRole, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  content_admin: 'secondary',
  audience_manager: 'secondary',
  user: 'outline',
}

export function GestaoEquipe() {
  const { profile } = useAuth()
  const [membros, setMembros] = useState<MembroEquipe[] | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)

  const ehAdmin = profile?.role === 'admin'

  const carregar = useCallback(async () => {
    if (!ehAdmin) return
    const { data, error } = await supabase.rpc('get_equipe')
    if (error) {
      setMembros([])
      return
    }
    setMembros((data as unknown as MembroEquipe[]) ?? [])
  }, [ehAdmin])

  useEffect(() => {
    void carregar()
  }, [carregar])

  if (!ehAdmin) return null

  async function alterarPapel(membro: MembroEquipe, novo: AppRole) {
    setSalvando(membro.id)
    const { error } = await supabase.rpc('definir_papel', {
      p_profile_id: membro.id,
      p_role: novo,
    })
    setSalvando(null)

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(
      `${membro.full_name} agora é ${PAPEIS.find((p) => p.valor === novo)?.rotulo.toLowerCase()}.`,
    )
    void carregar()
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="size-4.5 text-primary" aria-hidden="true" />
          Equipe e permissões
        </CardTitle>
        <CardDescription>
          Só o administrador vê e altera esta seção. Você não pode remover o próprio acesso, para
          a conta nunca ficar sem administrador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {membros === null ? (
          <Skeleton className="h-32 w-full" />
        ) : membros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="border-b text-left">
                <tr>
                  <th className="pb-2 font-medium">Pessoa</th>
                  <th className="pb-2 font-medium">Perfil comercial</th>
                  <th className="pb-2 text-right font-medium">Buscas</th>
                  <th className="pb-2 font-medium">Papel no sistema</th>
                </tr>
              </thead>
              <tbody>
                {membros.map((m) => {
                  const euMesmo = m.id === profile?.id
                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <p className="font-medium">
                          {m.full_name}
                          {euMesmo && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              você
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                        <p className="text-xs text-muted-foreground">
                          desde {formatDate(m.created_at)}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {COMMERCIAL_ROLE_LABELS[m.commercial_role as CommercialRole] ??
                          m.commercial_role}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                        {m.buscas}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={COR_PAPEL[m.role]}>
                            {PAPEIS.find((p) => p.valor === m.role)?.rotulo ?? m.role}
                          </Badge>
                          <Select
                            value={m.role}
                            disabled={salvando === m.id || euMesmo}
                            onValueChange={(v) => void alterarPapel(m, v as AppRole)}
                          >
                            <SelectTrigger className="h-8 w-44" aria-label={`Papel de ${m.full_name}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAPEIS.map((p) => (
                                <SelectItem key={p.valor} value={p.valor}>
                                  <span className="flex flex-col">
                                    <span>{p.rotulo}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {p.descricao}
                                    </span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
