import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase'

/**
 * Convite para a conversa com o Viver de IA, no fim do plano de ação.
 *
 * POR QUE AQUI DENTRO E NÃO DEPOIS. A ideia da Bárbara na call de 18/08: um
 * CTA que chega depois do plano é anúncio colado no fim, e se lê como anúncio.
 * Dentro do plano, respondendo "como eu executo isso tudo sem braço", ele é a
 * continuação natural do que a pessoa acabou de ler. Por isso o texto da seção
 * é escrito pelo mesmo modelo que escreveu o plano, a partir da dor dela, e
 * este componente só cuida do convite.
 *
 * QUEM VÊ O BOTÃO. O documento da parceria é explícito: o produto do parceiro
 * é B2B e o vendedor "não é alvo das peças que convidam para a aula e levam à
 * oferta". Ele lê a seção inteira, que é conteúdo útil sobre IA no dia a dia
 * dele, e não recebe o botão. Isso está em PERFIS_COM_CTA no backend e na
 * constante abaixo, e é uma linha para mudar se a decisão mudar.
 */

const PERFIS_COM_CTA = ['dono_empresa', 'gestor_comercial']

const URL_VIVERDEIA =
  'https://type.viverdeia.ai/new?utm_source=embaixador&utm_medium=plano-de-acao&utm_campaign=concer-finder&utm_term=concer'

export function CtaViverDeIA({ searchId }: { searchId?: string | null }) {
  const { profile } = useAuth()
  const [indo, setIndo] = useState(false)

  if (!profile || !PERFIS_COM_CTA.includes(profile.commercial_role)) return null

  /**
   * Registra o clique e sai do caminho.
   *
   * A UTM conta a história para o parceiro; esta linha conta para a Concer,
   * que é quem precisa saber QUEM clicou e depois de qual dor para vender
   * espaço a outros parceiros um dia. O await é curto e local, mas se o
   * registro falhar a navegação acontece do mesmo jeito: perder um clique no
   * relatório é ruim, segurar a pessoa na tela por causa disso é pior.
   */
  async function registrar() {
    setIndo(true)
    try {
      await supabase.from('cta_clicks').insert({
        profile_id: profile!.id,
        search_id: searchId ?? null,
        destino: 'viverdeia',
        local: 'plano-de-acao',
      })
    } catch {
      // clique perdido no relatório, navegação preservada
    } finally {
      setIndo(false)
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Quer ver isso rodando na sua operação?</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          O Thiago se juntou ao Viver de IA, que tem dezenas de soluções prontas para o
          comercial. Em uma conversa eles apontam por onde começar no seu caso.
        </p>
      </div>
      <Button asChild disabled={indo}>
        <a
          href={URL_VIVERDEIA}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void registrar()}
        >
          Falar com o Viver de IA
          <ArrowUpRight />
        </a>
      </Button>
    </div>
  )
}
