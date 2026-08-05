import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert, CircleCheck, PlayCircle, Stethoscope, Target } from 'lucide-react'
import { ROUTES } from '@/lib/routes'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SearchHit } from '@/types/search'

/**
 * Renderiza o plano de ação gerado pelo LLM.
 *
 * O modelo devolve um markdown simples e previsível (## seção, lista
 * numerada, bullets), então um parser pequeno resolve sem trazer uma
 * dependência de markdown para o bundle.
 *
 * Duas coisas além de formatar:
 *  - cada seção tem tratamento visual próprio (diagnóstico, passos, erros,
 *    sinais), porque elas se leem de formas diferentes;
 *  - as citações "(Trecho N, min X:XX)" viram link para o vídeo no minuto,
 *    fechando o ciclo entre o plano e a fonte que o embasou.
 */

// ------------------------------------------------------------------
// Parser
// ------------------------------------------------------------------

type Bloco =
  | { tipo: 'paragrafo'; texto: string }
  | { tipo: 'lista'; ordenada: boolean; itens: string[] }

interface Secao {
  titulo: string | null
  blocos: Bloco[]
}

function parse(markdown: string): Secao[] {
  const secoes: Secao[] = []
  let secao: Secao = { titulo: null, blocos: [] }
  let lista: { ordenada: boolean; itens: string[] } | null = null

  const fecharLista = () => {
    if (lista) {
      secao.blocos.push({ tipo: 'lista', ...lista })
      lista = null
    }
  }

  const fecharSecao = () => {
    fecharLista()
    if (secao.titulo !== null || secao.blocos.length > 0) secoes.push(secao)
    secao = { titulo: null, blocos: [] }
  }

  for (const linhaBruta of markdown.split('\n')) {
    const linha = linhaBruta.trim()

    // Linha em branco NÃO fecha a lista: o modelo separa os passos com
    // linha em branco, e fechar aqui fazia cada item virar uma lista nova,
    // reiniciando a numeração em 1.
    if (!linha) continue

    const titulo = linha.match(/^#{1,4}\s+(.*)$/)
    if (titulo) {
      fecharSecao()
      secao = { titulo: titulo[1], blocos: [] }
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

    // Linha solta logo depois de um item: é continuação dele, não um
    // parágrafo novo (o modelo quebra linha dentro de passos longos).
    if (lista && lista.itens.length > 0) {
      lista.itens[lista.itens.length - 1] += ' ' + linha
      continue
    }

    fecharLista()
    secao.blocos.push({ tipo: 'paragrafo', texto: linha })
  }

  fecharSecao()
  return secoes
}

// ------------------------------------------------------------------
// Texto com destaque e citações clicáveis
// ------------------------------------------------------------------

/** "(Trecho 3, min 10:15)" -> índice do trecho e minutagem. */
const CITACAO = /\(\s*trechos?\s+(\d+)[^)]*?min\s+([\d:]+)\s*\)/gi

function TrechoLink({ indice, minuto, hit }: { indice: number; minuto: string; hit?: SearchHit }) {
  const conteudo = (
    <>
      <PlayCircle className="size-3.5" aria-hidden="true" />
      min {minuto}
    </>
  )

  const classe =
    'mx-0.5 inline-flex translate-y-px items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 align-middle text-[13px] font-medium text-primary'

  if (!hit) {
    return (
      <span className={classe} title={`Trecho ${indice}`}>
        {conteudo}
      </span>
    )
  }

  return (
    <Link
      to={`${ROUTES.video(hit.video_id)}?t=${hit.start_seconds}&s=${hit.segment_id}`}
      className={cn(classe, 'transition-colors hover:bg-primary/20')}
      title={`${hit.title} • abrir em ${formatTimestamp(hit.start_seconds)}`}
    >
      {conteudo}
    </Link>
  )
}

/** Aplica **negrito** e transforma as citações de trecho em link. */
function Texto({ children, segments }: { children: string; segments?: SearchHit[] }) {
  const partes: React.ReactNode[] = []
  let cursor = 0
  let chave = 0

  // primeiro as citações, para não perder posição ao aplicar o negrito
  for (const m of children.matchAll(CITACAO)) {
    const inicio = m.index ?? 0
    if (inicio > cursor) partes.push(...comNegrito(children.slice(cursor, inicio), chave++))
    const indice = Number(m[1])
    partes.push(
      <TrechoLink key={`t${chave++}`} indice={indice} minuto={m[2]} hit={segments?.[indice - 1]} />,
    )
    cursor = inicio + m[0].length
  }
  if (cursor < children.length) partes.push(...comNegrito(children.slice(cursor), chave++))

  return <>{partes}</>
}

function comNegrito(texto: string, semente: number): React.ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') ? (
      <strong key={`b${semente}-${i}`} className="font-semibold text-foreground">
        {parte.slice(2, -2)}
      </strong>
    ) : (
      <span key={`s${semente}-${i}`}>{parte}</span>
    ),
  )
}

// ------------------------------------------------------------------
// Seções
// ------------------------------------------------------------------

type Estilo = 'diagnostico' | 'passos' | 'erros' | 'sinais' | 'generico'

function classificar(titulo: string | null): Estilo {
  const t = (titulo ?? '').toLowerCase()
  if (t.includes('acontecendo') || t.includes('diagn')) return 'diagnostico'
  if (t.includes('plano') || t.includes('passo')) return 'passos'
  if (t.includes('erro') || t.includes('sabot') || t.includes('evitar')) return 'erros'
  if (t.includes('funcionou') || t.includes('sinais') || t.includes('saber')) return 'sinais'
  return 'generico'
}

const ICONE: Record<Estilo, typeof Target> = {
  diagnostico: Stethoscope,
  passos: Target,
  erros: CircleAlert,
  sinais: CircleCheck,
  generico: Target,
}

function TituloSecao({ titulo, estilo }: { titulo: string; estilo: Estilo }) {
  const Icone = ICONE[estilo]
  return (
    <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
      <Icone
        className={cn(
          'size-4.5',
          estilo === 'sinais' && 'text-success',
          estilo === 'erros' && 'text-gold',
          (estilo === 'diagnostico' || estilo === 'passos' || estilo === 'generico') &&
            'text-primary',
        )}
        aria-hidden="true"
      />
      {titulo}
    </h3>
  )
}

export function ActionPlan({
  markdown,
  segments,
}: {
  markdown: string
  /** Trechos na mesma ordem enviada ao modelo: "Trecho N" = segments[N-1]. */
  segments?: SearchHit[]
}) {
  const secoes = useMemo(() => parse(markdown), [markdown])

  return (
    <div className="space-y-8">
      {secoes.map((secao, s) => {
        const estilo = classificar(secao.titulo)

        return (
          <section key={s}>
            {secao.titulo && <TituloSecao titulo={secao.titulo} estilo={estilo} />}

            {secao.blocos.map((bloco, b) => {
              if (bloco.tipo === 'paragrafo') {
                // Em erros e sinais o modelo às vezes escreve "**Erro.** por quê"
                // como parágrafo solto, em vez de bullet. Recebe o mesmo ícone,
                // senão a seção perde a leitura de lista.
                if (estilo === 'erros' || estilo === 'sinais') {
                  const IconeItem = estilo === 'erros' ? CircleAlert : CircleCheck
                  return (
                    <div key={b} className={cn('flex gap-2.5', b > 0 && 'mt-2.5')}>
                      <IconeItem
                        className={cn(
                          'mt-0.5 size-4.5 shrink-0',
                          estilo === 'erros' ? 'text-gold' : 'text-success',
                        )}
                        aria-hidden="true"
                      />
                      <p className="text-[15px] leading-relaxed text-foreground/90">
                        <Texto segments={segments}>{bloco.texto}</Texto>
                      </p>
                    </div>
                  )
                }

                // Diagnóstico: bloco destacado, é a leitura de contexto
                return (
                  <p
                    key={b}
                    className={cn(
                      'text-[15px] leading-relaxed text-foreground/90',
                      estilo === 'diagnostico' &&
                        'rounded-lg border-l-2 border-primary bg-muted/60 p-4',
                      b > 0 && 'mt-3',
                    )}
                  >
                    <Texto segments={segments}>{bloco.texto}</Texto>
                  </p>
                )
              }

              // Cards numerados só nos passos. Sinais e erros usam ícone mesmo
              // quando o modelo resolve numerar: o estilo vem da seção, não
              // do formato que ele escolheu na hora.
              if (bloco.ordenada && estilo !== 'sinais' && estilo !== 'erros') {
                return (
                  <ol key={b} className="space-y-3">
                    {bloco.itens.map((item, i) => (
                      <li
                        key={i}
                        className="flex gap-3.5 rounded-lg border bg-card p-4 sombra-card"
                      >
                        <span
                          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold tabular-nums text-primary"
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                        <span className="text-[15px] leading-relaxed text-foreground/90">
                          <Texto segments={segments}>{item}</Texto>
                        </span>
                      </li>
                    ))}
                  </ol>
                )
              }

              // Sinais e erros: lista com ícone no lugar do bullet
              const IconeItem = estilo === 'erros' ? CircleAlert : CircleCheck
              return (
                <ul key={b} className="space-y-2.5">
                  {bloco.itens.map((item, i) => (
                    <li key={i} className="flex gap-2.5">
                      <IconeItem
                        className={cn(
                          'mt-0.5 size-4.5 shrink-0',
                          estilo === 'erros' ? 'text-gold' : 'text-success',
                        )}
                        aria-hidden="true"
                      />
                      <span className="text-[15px] leading-relaxed text-foreground/90">
                        <Texto segments={segments}>{item}</Texto>
                      </span>
                    </li>
                  ))}
                </ul>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
