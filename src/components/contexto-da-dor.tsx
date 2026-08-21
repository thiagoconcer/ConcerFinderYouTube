import { useState } from 'react'
import { Check, Loader2, MessageCircleQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * A pergunta que o sistema faz depois de entregar os trechos, para o plano ser
 * escrito para o caso da pessoa e não para o caso médio.
 *
 * A caixa NÃO segura o plano, e isso foi testado do jeito caro: por um dia ela
 * segurou, e 4 de 5 pessoas saíram sem plano nenhum em vez de responder. Agora
 * ela aparece ACIMA do plano enquanto ele é escrito. Quem ignora fica com o
 * plano de sempre; quem responde ganha um plano reescrito com o caso dela.
 *
 * As opções vêm antes do campo aberto porque campo aberto sozinho é respondido
 * com duas palavras. Um clique já muda o plano, e quem quiser detalhar detalha.
 */

interface Props {
  pergunta: string
  opcoes: string[]
  enviando: boolean
  onEnviar: (resposta: string) => void
  onDispensar: () => void
}

export function ContextoDaDor({ pergunta, opcoes, enviando, onEnviar, onDispensar }: Props) {
  const [escolhidas, setEscolhidas] = useState<string[]>([])
  const [texto, setTexto] = useState('')

  function alternar(opcao: string) {
    setEscolhidas((atual) =>
      atual.includes(opcao) ? atual.filter((o) => o !== opcao) : [...atual, opcao],
    )
  }

  // A resposta enviada junta as duas formas de responder: o que ela clicou e o
  // que ela escreveu. Para o modelo é uma coisa só, o contexto do caso dela.
  const resposta = [escolhidas.join('. '), texto.trim()].filter(Boolean).join('. ')
  const podeEnviar = resposta.length > 0 && !enviando

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader>
        <CardTitle className="flex items-start gap-2 text-base">
          <MessageCircleQuestion className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            <span className="mr-1.5 text-muted-foreground">Para o plano ficar do seu jeito:</span>
            {pergunta}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {opcoes.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {opcoes.map((opcao) => {
              const ativa = escolhidas.includes(opcao)
              return (
                <li key={opcao}>
                  <button
                    type="button"
                    onClick={() => alternar(opcao)}
                    aria-pressed={ativa}
                    disabled={enviando}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-60 ${
                      ativa
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {ativa && <Check className="size-3.5" />}
                    {opcao}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <textarea
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          disabled={enviando}
          rows={2}
          maxLength={600}
          placeholder="Se quiser, conta mais da tua situação (o que você vende, pra quem, o que já tentou)"
          className="w-full resize-y rounded-lg border bg-background px-3.5 py-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
          aria-label="Mais contexto sobre a sua situação"
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => onEnviar(resposta)} disabled={!podeEnviar}>
            {enviando ? <Loader2 className="animate-spin" /> : null}
            {enviando ? 'Refazendo o plano...' : 'Refinar meu plano'}
          </Button>
          <Button type="button" variant="ghost" onClick={onDispensar} disabled={enviando}>
            Agora não
          </Button>
          <span className="text-xs text-muted-foreground">
            Sem responder, o plano abaixo continua valendo.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
