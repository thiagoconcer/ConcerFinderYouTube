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

export function CtaViverDeIA({
  searchId,
  solucao,
}: {
  searchId?: string | null
  /** Solução que o modelo citou no texto. O convite fala dela, não de "isso". */
  solucao?: string | null
}) {
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
    /* Empilhado, nunca lado a lado.
       A versão anterior punha texto e botão na mesma linha flex. O botão tem
       largura fixa, então no celular sobrava uma coluna do tamanho da maior
       palavra e o convite saía com uma palavra por linha. Aqui o texto ocupa a
       largura inteira e o botão vem embaixo, que é o comportamento correto em
       qualquer tela. */
    <div className="mt-5 rounded-lg border border-primary/25 bg-primary/[0.04] p-4 sm:p-5">
      <p className="text-[15px] font-semibold text-foreground">
        {solucao
          ? `Quer ${solucao} rodando na sua operação?`
          : 'Quer ver isso rodando na sua operação?'}
      </p>

      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {solucao
          ? `${solucao} é uma das dezenas de soluções prontas do Viver de IA, com quem o Thiago se juntou.`
          : 'O Viver de IA, com quem o Thiago se juntou, tem dezenas de soluções prontas para o comercial.'}{' '}
        Na conversa eles olham a sua operação e dizem por onde começar.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Button asChild disabled={indo} className="w-full sm:w-auto">
          <a
            href={URL_VIVERDEIA}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void registrar()}
          >
            Agendar uma conversa
            <ArrowUpRight />
          </a>
        </Button>
        {/* Botão de "agendar" que abre formulário quebra promessa. Dizer o que
            vem antes do horário custa uma linha e evita a frustração. */}
        <span className="text-xs leading-snug text-muted-foreground">
          Algumas perguntas rápidas antes de escolher o horário.
        </span>
      </div>
    </div>
  )
}
