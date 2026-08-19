import { useState } from 'react'
import { ArrowUpRight, Check } from 'lucide-react'
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
          ? `${solucao} não é para você construir. Já existe pronto.`
          : 'Isso não é para você construir. Já existe pronto.'}
      </p>

      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {solucao ? `${solucao} é uma das mais de 150 soluções` : 'São mais de 150 soluções'}{' '}
        prontas do Viver de IA, a plataforma de IA que Thiago Concer indica para quem
        precisa executar e não só entender.
      </p>

      {/* Três provas, e não uma frase de efeito. A pessoa acabou de ler um
          plano que exige trabalho diário; o que convence aqui é mostrar que o
          trabalho já está construído, que ela customiza e que não fica sozinha
          se travar. Um exemplo só não sustenta isso. */}
      <ul className="mt-3.5 space-y-2">
        {[
          'Vendedora de IA que atende no WhatsApp a qualquer hora, treino do time com as calls reais, análise de reunião, CRM, relatório diário de vendas e prospecção ativa.',
          'Você não desenvolve nada: o projeto é transferido pronto para a sua conta em um clique, e a partir daí é seu para editar.',
          'Mentoria ao vivo com especialista todo dia útil, das 9h às 19h, para destravar a implementação.',
        ].map((linha) => (
          <li key={linha} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{linha}</span>
          </li>
        ))}
      </ul>

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
          Algumas perguntas rápidas sobre a sua operação e você escolhe o horário.
        </span>
      </div>
    </div>
  )
}
