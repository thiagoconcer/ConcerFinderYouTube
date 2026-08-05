import { handler, json } from '../_shared/http.ts'
import { requireStaffOrService } from '../_shared/supabase.ts'
import { contatosPorTag } from '../_shared/activecampaign.ts'

/**
 * nurture-status
 * Devolve, para a base inteira de leads, em que ponto da régua de nutrição
 * cada pessoa está. Usado pelo painel de leads.
 *
 * Por que buscar POR TAG e não por contato: perguntar ao ActiveCampaign as
 * tags de cada lead custa uma chamada por pessoa. Com 500 leads isso é 500
 * chamadas e a página não abre. Perguntando quem tem cada tag, são 7 chamadas
 * no total, independentemente do tamanho da base, e o resultado é o mesmo.
 *
 * Falha do ActiveCampaign não pode derrubar o painel: a lista de leads é dado
 * do nosso banco e continua útil sem a coluna de nutrição. Por isso o erro vem
 * como `disponivel: false` em vez de status 500.
 */

/** Ordem das etapas. A última tag que a pessoa tem é onde ela está. */
const ETAPAS = [
  { tag: 'concerfinder - regua d0', etapa: 'd0', rotulo: 'E-mail 1 enviado' },
  { tag: 'concerfinder - regua d2', etapa: 'd2', rotulo: 'E-mail 2 enviado' },
  { tag: 'concerfinder - regua d5', etapa: 'd5', rotulo: 'E-mail 3 enviado' },
  { tag: 'concerfinder - regua d9', etapa: 'd9', rotulo: 'Régua concluída' },
]

const FLUXOS = [
  { tag: 'concerfinder - vendedor', fluxo: 'vendedor' },
  { tag: 'concerfinder - gestor', fluxo: 'gestor' },
  { tag: 'concerfinder - dono', fluxo: 'dono' },
]

interface Situacao {
  fluxo: string | null
  etapa: string | null
  rotulo: string
}

Deno.serve(handler(async (req) => {
  await requireStaffOrService(req)

  const porEmail = new Map<string, Situacao>()

  try {
    for (const f of FLUXOS) {
      for (const email of await contatosPorTag(f.tag)) {
        const atual = porEmail.get(email) ?? { fluxo: null, etapa: null, rotulo: 'Aguardando primeira busca' }
        porEmail.set(email, { ...atual, fluxo: f.fluxo })
      }
    }

    // Na ordem: cada etapa encontrada sobrescreve a anterior, então sobra a
    // mais avançada que a pessoa alcançou.
    for (const e of ETAPAS) {
      for (const email of await contatosPorTag(e.tag)) {
        const atual = porEmail.get(email) ?? { fluxo: null, etapa: null, rotulo: '' }
        porEmail.set(email, { ...atual, etapa: e.etapa, rotulo: e.rotulo })
      }
    }
  } catch (error) {
    console.warn('nao foi possivel ler o ActiveCampaign:', error)
    return json({ disponivel: false, motivo: String(error).slice(0, 200), situacoes: {} })
  }

  return json({
    disponivel: true,
    total: porEmail.size,
    situacoes: Object.fromEntries(porEmail),
  })
}))
