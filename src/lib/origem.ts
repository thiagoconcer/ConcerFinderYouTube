/**
 * Origem do lead: de onde a pessoa veio.
 *
 * O problema que isto resolve: a pessoa chega em `/?utm_source=instagram`,
 * lê a landing, clica em "criar conta" e só então se cadastra. Nesse momento
 * a URL é `/cadastro`, sem parâmetro nenhum, e a origem já se perdeu. Por isso
 * capturamos na PRIMEIRA visita e guardamos até o cadastro acontecer.
 *
 * Primeiro toque, nunca sobrescrito: o que interessa é o que TROUXE a pessoa.
 * Se ela voltar depois por outro caminho, a origem original continua valendo,
 * senão todo lead acabaria marcado como "direto", que é como a maioria retorna.
 */

const CHAVE = 'concerfinder-origem'

export interface Origem {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  referrer?: string
  landing_page?: string
}

/** Campos grandes demais são ruído; o banco não precisa de URL de 4 KB. */
function limitar(valor: string | null | undefined, max = 200): string | undefined {
  const v = (valor ?? '').trim()
  return v ? v.slice(0, max) : undefined
}

/**
 * Referrer de dentro do próprio site não é origem: se a pessoa navegou de
 * `/busca` para `/cadastro`, gravar "finder.thiagoconcer.com.br" apagaria a
 * origem de verdade.
 */
function referrerExterno(): string | undefined {
  const ref = document.referrer
  if (!ref) return undefined
  try {
    if (new URL(ref).host === window.location.host) return undefined
  } catch {
    return undefined
  }
  return limitar(ref)
}

/**
 * Chamada uma vez no carregamento do app. Só grava se ainda não houver nada:
 * a primeira visita é a que conta.
 */
export function capturarOrigem(): void {
  try {
    if (localStorage.getItem(CHAVE)) return

    const p = new URLSearchParams(window.location.search)
    const origem: Origem = {
      utm_source: limitar(p.get('utm_source'), 80),
      utm_medium: limitar(p.get('utm_medium'), 80),
      utm_campaign: limitar(p.get('utm_campaign'), 120),
      utm_content: limitar(p.get('utm_content'), 120),
      utm_term: limitar(p.get('utm_term'), 120),
      referrer: referrerExterno(),
      landing_page: limitar(window.location.pathname + window.location.search, 300),
    }

    // Visita sem UTM e sem referrer externo ainda é informação ("direto"),
    // mas só vale gravar se houver ao menos a página de entrada.
    if (!origem.landing_page) return
    localStorage.setItem(CHAVE, JSON.stringify(origem))
  } catch {
    // Navegador com storage bloqueado: perder a origem não pode quebrar o app.
  }
}

/** Lida no cadastro, para viajar junto do lead. */
export function lerOrigem(): Origem {
  try {
    const bruto = localStorage.getItem(CHAVE)
    return bruto ? (JSON.parse(bruto) as Origem) : {}
  } catch {
    return {}
  }
}

/** Só para leitura humana no painel e em teste. */
export function origemLegivel(o: Origem): string {
  if (o.utm_source) return o.utm_source.toLowerCase()
  if (o.referrer) {
    try {
      return new URL(o.referrer).host.replace(/^www\./, '')
    } catch {
      return o.referrer
    }
  }
  return 'direto'
}
