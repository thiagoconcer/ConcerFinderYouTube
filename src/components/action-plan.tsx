import { useMemo } from 'react'

/**
 * Renderiza o plano de ação vindo do LLM.
 * O modelo devolve um markdown simples e previsível (## título, lista
 * numerada, bullets), então um parser pequeno resolve sem trazer
 * dependência de markdown para o bundle.
 */

type Bloco =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'paragrafo'; texto: string }
  | { tipo: 'lista'; ordenada: boolean; itens: string[] }

function parse(markdown: string): Bloco[] {
  const blocos: Bloco[] = []
  let lista: { ordenada: boolean; itens: string[] } | null = null

  const fecharLista = () => {
    if (lista) {
      blocos.push({ tipo: 'lista', ...lista })
      lista = null
    }
  }

  for (const linhaBruta of markdown.split('\n')) {
    const linha = linhaBruta.trim()

    if (!linha) {
      fecharLista()
      continue
    }

    const titulo = linha.match(/^#{1,4}\s+(.*)$/)
    if (titulo) {
      fecharLista()
      blocos.push({ tipo: 'titulo', texto: titulo[1] })
      continue
    }

    const numerado = linha.match(/^(\d+)[.)]\s+(.*)$/)
    if (numerado) {
      if (!lista?.ordenada) {
        fecharLista()
        lista = { ordenada: true, itens: [] }
      }
      lista.itens.push(numerado[2])
      continue
    }

    const bullet = linha.match(/^[-*•]\s+(.*)$/)
    if (bullet) {
      if (!lista || lista.ordenada) {
        fecharLista()
        lista = { ordenada: false, itens: [] }
      }
      lista.itens.push(bullet[1])
      continue
    }

    fecharLista()
    blocos.push({ tipo: 'paragrafo', texto: linha })
  }

  fecharLista()
  return blocos
}

/** Aplica **negrito** dentro de um texto. */
function comNegrito(texto: string) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') ? (
      <strong key={i} className="font-semibold text-foreground">
        {parte.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{parte}</span>
    ),
  )
}

export function ActionPlan({ markdown }: { markdown: string }) {
  const blocos = useMemo(() => parse(markdown), [markdown])

  return (
    <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
      {blocos.map((bloco, i) => {
        if (bloco.tipo === 'titulo') {
          return (
            <h3 key={i} className="pt-2 text-base font-semibold text-foreground first:pt-0">
              {bloco.texto}
            </h3>
          )
        }
        if (bloco.tipo === 'paragrafo') {
          return <p key={i}>{comNegrito(bloco.texto)}</p>
        }
        return bloco.ordenada ? (
          <ol key={i} className="list-decimal space-y-2 pl-5 marker:text-muted-foreground/70">
            {bloco.itens.map((item, j) => (
              <li key={j}>{comNegrito(item)}</li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="list-disc space-y-2 pl-5 marker:text-muted-foreground/70">
            {bloco.itens.map((item, j) => (
              <li key={j}>{comNegrito(item)}</li>
            ))}
          </ul>
        )
      })}
    </div>
  )
}
