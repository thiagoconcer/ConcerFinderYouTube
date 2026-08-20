import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { topicLabel } from '@/lib/format'
import { CARGO_LABELS, COMMERCIAL_ROLE_LABELS } from '@/types/database'
import type { Cargo, CommercialRole } from '@/types/database'
import type { LeadsFacetas } from '@/types/leads'

export const TODOS = 'todos'

export interface FiltrosLeads {
  perfil: string
  cargo: string
  origem: string
  regua: string
  tema: string
  faixa: string
  atividade: string
}

export const FILTROS_VAZIOS: FiltrosLeads = {
  perfil: TODOS,
  cargo: TODOS,
  origem: TODOS,
  regua: TODOS,
  tema: TODOS,
  faixa: TODOS,
  atividade: TODOS,
}

export function temFiltro(f: FiltrosLeads): boolean {
  return Object.values(f).some((v) => v !== TODOS)
}

const REGUA_LABELS: Record<string, string> = {
  pending: 'Régua pendente',
  sent: 'Régua enviada',
  failed: 'Régua falhou',
  sem_regua: 'Fora da régua',
}

const FAIXAS = [
  { valor: 'quente', rotulo: 'Quente' },
  { valor: 'morno', rotulo: 'Morno' },
  { valor: 'frio', rotulo: 'Frio' },
]

const ATIVIDADES = [
  { valor: 'buscou', rotulo: 'Já buscou' },
  { valor: 'nao_buscou', rotulo: 'Cadastrou e não buscou' },
  { valor: 'abriu_trecho', rotulo: 'Abriu algum trecho' },
  { valor: 'clicou_convite', rotulo: 'Clicou no convite' },
]

/**
 * Os recortes que a equipe faz de cabeça quando lê a lista inteira.
 *
 * Cargo, perfil, faixa de score e atividade são listas fixas do produto, então
 * moram aqui. Origem, tema e régua vêm do banco com contagem (`get_leads_facetas`)
 * por dois motivos: origem é aberta (qualquer utm_source, qualquer domínio de
 * referrer), e uma opção que devolveria zero não deveria ser oferecida.
 *
 * "Cadastrou e não buscou" é o filtro que mais vale a pena: é a lista de quem
 * levantou a mão e parou no meio, e é a única que aponta para uma ação concreta
 * (ligar, mandar a dor pronta por WhatsApp).
 */
export function FiltrosLeadsBar({
  filtros,
  facetas,
  onChange,
  onLimpar,
}: {
  filtros: FiltrosLeads
  facetas: LeadsFacetas | null
  onChange: (novos: FiltrosLeads) => void
  onLimpar: () => void
}) {
  const set = (chave: keyof FiltrosLeads) => (valor: string) =>
    onChange({ ...filtros, [chave]: valor })

  const contagem = (lista: Array<{ valor: string; total: number }> | undefined, valor: string) => {
    const item = lista?.find((i) => i.valor === valor)
    return item ? ` (${item.total})` : ''
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={filtros.perfil} onValueChange={set('perfil')}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Todos os perfis" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os perfis</SelectItem>
          {(Object.keys(COMMERCIAL_ROLE_LABELS) as CommercialRole[]).map((p) => (
            <SelectItem key={p} value={p}>
              {COMMERCIAL_ROLE_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filtros.cargo} onValueChange={set('cargo')}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Todos os cargos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os cargos</SelectItem>
          {(Object.keys(CARGO_LABELS) as Cargo[]).map((c) => (
            <SelectItem key={c} value={c}>
              {CARGO_LABELS[c]}
              {contagem(facetas?.cargos, c)}
            </SelectItem>
          ))}
          <SelectItem value="nao_informado">
            Sem cargo{contagem(facetas?.cargos, 'nao_informado')}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select value={filtros.origem} onValueChange={set('origem')}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Todas as origens" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todas as origens</SelectItem>
          {(facetas?.origens ?? []).map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.valor} ({o.total})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filtros.regua} onValueChange={set('regua')}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Régua" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Toda a régua</SelectItem>
          {(facetas?.reguas ?? []).map((r) => (
            <SelectItem key={r.valor} value={r.valor}>
              {REGUA_LABELS[r.valor] ?? r.valor} ({r.total})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filtros.tema} onValueChange={set('tema')}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Tema buscado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Qualquer tema buscado</SelectItem>
          {(facetas?.temas ?? []).map((t) => (
            <SelectItem key={t.valor} value={t.valor}>
              {topicLabel(t.valor)} ({t.total})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filtros.faixa} onValueChange={set('faixa')}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Score" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Qualquer score</SelectItem>
          {FAIXAS.map((f) => (
            <SelectItem key={f.valor} value={f.valor}>
              {f.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filtros.atividade} onValueChange={set('atividade')}>
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Atividade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Qualquer atividade</SelectItem>
          {ATIVIDADES.map((a) => (
            <SelectItem key={a.valor} value={a.valor}>
              {a.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {temFiltro(filtros) && (
        <Button variant="ghost" onClick={onLimpar}>
          <X />
          Limpar filtros
        </Button>
      )}
    </div>
  )
}
