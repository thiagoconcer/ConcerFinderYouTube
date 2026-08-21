import { optionalSecret } from './http.ts'

/**
 * Integração com o ActiveCampaign.
 *
 * O que faz esta régua não ser newsletter: os campos personalizados levam a
 * dor REAL que a pessoa escreveu na busca e o link do trecho no minuto exato.
 * Por isso a tag que dispara a automação (o perfil comercial) só é aplicada
 * DEPOIS da primeira busca: no cadastro ainda não existe dor para contar, e o
 * primeiro e-mail sairia vazio justamente no que ele tem de melhor.
 *
 * IDs de campo e tag são resolvidos em runtime pelo nome, não fixados no
 * código: se alguém renomear ou recriar algo no AC, isto continua funcionando.
 */

const AC_BASE = 'https://thiagoconcer56558.api-us1.com/api/3'

export type PerfilComercial = 'vendedor' | 'gestor_comercial' | 'dono_empresa'

export const TAG_NEWSLETTER = 'newsletter gestores e donos'
export const TAG_LEAD = 'concerfinder - lead'
export const TAG_ENGAJOU = 'concerfinder - engajou'
export const TAG_BUSCOU_DE_NOVO = 'concerfinder - buscou de novo'

/** Tag de gatilho da automação, uma por perfil. */
export const TAG_POR_PERFIL: Record<PerfilComercial, string> = {
  vendedor: 'concerfinder - vendedor',
  gestor_comercial: 'concerfinder - gestor',
  dono_empresa: 'concerfinder - dono',
}

export const ROTULO_PERFIL: Record<PerfilComercial, string> = {
  vendedor: 'Vendedor',
  gestor_comercial: 'Gestor comercial',
  dono_empresa: 'Dono de empresa',
}

function token(): string | null {
  return optionalSecret('ACTIVECAMPAIGN_API_TOKEN') ?? null
}

async function ac(method: string, path: string, body?: unknown) {
  const chave = token()
  if (!chave) throw new Error('ACTIVECAMPAIGN_API_TOKEN não configurada')

  const res = await fetch(`${AC_BASE}/${path}`, {
    method,
    headers: { 'Api-Token': chave, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  })
  const texto = await res.text()
  let json: any = {}
  try {
    json = texto ? JSON.parse(texto) : {}
  } catch {
    json = { raw: texto.slice(0, 300) }
  }
  if (!res.ok) {
    throw new Error(`AC ${method} ${path} -> ${res.status}: ${JSON.stringify(json).slice(0, 250)}`)
  }
  return json
}

// Cache por instância da função: evita relistar campos e tags a cada lead.
let cacheCampos: Record<string, string> | null = null
let cacheTags: Record<string, string> | null = null

async function camposPorPerstag(): Promise<Record<string, string>> {
  if (cacheCampos) return cacheCampos
  const r = await ac('GET', 'fields?limit=100')
  cacheCampos = Object.fromEntries((r.fields ?? []).map((f: any) => [f.perstag, f.id]))
  return cacheCampos
}

async function tagsPorNome(): Promise<Record<string, string>> {
  if (cacheTags) return cacheTags
  const r = await ac('GET', 'tags?limit=200')
  cacheTags = Object.fromEntries((r.tags ?? []).map((t: any) => [t.tag.toLowerCase(), t.id]))
  return cacheTags
}

/** Cria a tag se ela não existir, para o fluxo nunca depender de setup manual. */
async function idDaTag(nome: string): Promise<string | null> {
  const mapa = await tagsPorNome()
  const existente = mapa[nome.toLowerCase()]
  if (existente) return existente

  try {
    const r = await ac('POST', 'tags', { tag: { tag: nome, tagType: 'contact' } })
    const id = r.tag?.id
    if (id) mapa[nome.toLowerCase()] = id
    return id ?? null
  } catch {
    return null
  }
}

/**
 * Rótulos do campo "Cargo Newsletter" (id 35) do ActiveCampaign, exatamente
 * como estão lá, inclusive o "(a)". O campo é do tipo radio: valor fora desta
 * lista o AC aceita mas não casa com nenhuma opção, então a segmentação por
 * cargo passaria a mentir em silêncio.
 */
const ROTULO_CARGO: Record<string, string> = {
  fundador: 'Fundador (a)',
  socio: 'Sócio (a)',
  presidente_ceo: 'Presidente ou CEO',
  vice_presidente: 'Vice-presidente',
  diretor: 'Diretor (a)',
  coordenador: 'Coordenador (a)',
  supervisor: 'Supervisor (a)',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
}

export interface DadosDoLead {
  nome: string
  email: string
  whatsapp: string
  perfil: PerfilComercial
  /** Slug do cargo. Ausente nos cadastros anteriores a esta mudança. */
  cargo?: string | null
  /** De onde a pessoa veio. Derivada: utm_source, senão domínio do referrer. */
  origem?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  cadastradoEm: string
  /** Preenchidos a partir da primeira busca; ausentes no momento do cadastro. */
  dorPrincipal?: string
  temas?: string[]
  videoRecomendado?: string
  linkTrecho?: string
  minutagem?: string
  totalBuscas?: number
  abriuAlgumTrecho?: boolean
}

export interface ResultadoSincronizacao {
  contatoId: string
  tagsAplicadas: string[]
  gatilhoAplicado: boolean
}

/**
 * ISO -> YYYY-MM-DD.
 *
 * Era MM/DD/YYYY, e esta conta do ActiveCampaign lê barra como DD/MM/YYYY:
 * um cadastro de 05/08/2026 virava 8 de maio. Com dia e mês ambos <= 12 o erro
 * é silencioso, e só apareceria como segmentação por data devolvendo gente
 * errada. YYYY-MM-DD não é ambíguo em nenhuma configuração de conta.
 */
function dataAC(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mm}-${dd}`
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? ''
}

function sobrenome(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return partes.length > 1 ? partes.slice(1).join(' ') : ''
}

/**
 * Cria ou atualiza o contato no AC com os campos personalizados e as tags.
 *
 * `aplicarGatilho` só deve ser true quando já existe uma dor real para contar:
 * é ele que faz a automação disparar. Chamar duas vezes é seguro, o AC não
 * reprocessa uma tag que o contato já tem e as automações são "executar uma vez".
 */
export async function sincronizarLead(
  dados: DadosDoLead,
  aplicarGatilho: boolean,
): Promise<ResultadoSincronizacao> {
  const campos = await camposPorPerstag()

  const valores: Array<{ field: string; value: string }> = []
  const põe = (perstag: string, valor: string | undefined) => {
    const id = campos[perstag]
    if (id && valor !== undefined && valor !== '') valores.push({ field: id, value: valor })
  }

  põe('CF_PERFIL_COMERCIAL', ROTULO_PERFIL[dados.perfil])
  // Alimenta o campo que a Concer já usava na newsletter, então o lead do
  // ConcerFinder fica no mesmo eixo do resto da base.
  põe('CARGO_NEWSLETTER', dados.cargo ? ROTULO_CARGO[dados.cargo] : undefined)
  // Origem no CRM: permite segmentar campanha lá dentro sem depender de
  // exportar o painel toda vez.
  põe('CF_ORIGEM', dados.origem ?? undefined)
  põe('CF_UTM_MEDIUM', dados.utmMedium ?? undefined)
  põe('CF_UTM_CAMPANHA', dados.utmCampaign ?? undefined)
  põe('CF_DATA_CADASTRO_CONCERFINDER', dataAC(dados.cadastradoEm))
  põe('CF_DOR_PRINCIPAL', dados.dorPrincipal)
  põe('CF_TEMAS_BUSCADOS', dados.temas?.join(', '))
  põe('CF_VIDEO_RECOMENDADO', dados.videoRecomendado)
  põe('CF_LINK_TRECHO', dados.linkTrecho)
  põe('CF_MINUTAGEM', dados.minutagem)
  põe('CF_TOTAL_BUSCAS', dados.totalBuscas !== undefined ? String(dados.totalBuscas) : undefined)

  // contact/sync faz upsert pelo e-mail: não duplica quem já está na base
  const sync = await ac('POST', 'contact/sync', {
    contact: {
      email: dados.email,
      firstName: primeiroNome(dados.nome),
      lastName: sobrenome(dados.nome),
      phone: dados.whatsapp,
      fieldValues: valores,
    },
  })

  const contatoId = String(sync.contact?.id ?? '')
  if (!contatoId) throw new Error('AC não devolveu o id do contato')

  /*
    Inscrição na lista, e não só tag.

    O `contact/sync` cria o contato, mas contato sem lista não entra em
    campanha nenhuma: a régua funciona (automação dispara por tag), e qualquer
    disparo pontual passa por cima da pessoa em silêncio. Descoberto em 21/08,
    quando o e-mail de aviso da falha alcançava 9 de 15 cadastrados.

    Quem cancelou inscrição fica de fora: reinscrever alguém que pediu para
    sair é a única coisa aqui que não se conserta depois.
  */
  const listaId = optionalSecret('AC_LIST_ID') ?? '3'
  try {
    const jaTem = await ac('GET', `contacts/${contatoId}/contactLists`)
    const nessaLista = (jaTem.contactLists ?? []).find(
      (l: Record<string, unknown>) => String(l.list) === listaId,
    )
    const cancelou = nessaLista && String(nessaLista.status) === '2'
    if (!cancelou && String(nessaLista?.status ?? '') !== '1') {
      await ac('POST', 'contactLists', {
        contactList: { list: Number(listaId), contact: Number(contatoId), status: 1 },
      })
    }
  } catch (erro) {
    // inscrição é acessório: se falhar, o lead e as tags já estão gravados
    console.warn('não consegui inscrever o contato na lista:', erro)
  }

  const aAplicar = [TAG_LEAD, TAG_NEWSLETTER]
  if ((dados.totalBuscas ?? 0) > 1) aAplicar.push(TAG_BUSCOU_DE_NOVO)
  if (dados.abriuAlgumTrecho) aAplicar.push(TAG_ENGAJOU)
  // por último: é a tag de gatilho, e o AC dispara na hora que ela entra,
  // então os campos personalizados precisam já estar gravados acima
  if (aplicarGatilho) aAplicar.push(TAG_POR_PERFIL[dados.perfil])

  const aplicadas: string[] = []
  for (const nome of aAplicar) {
    const tagId = await idDaTag(nome)
    if (!tagId) continue
    try {
      await ac('POST', 'contactTags', { contactTag: { contact: contatoId, tag: tagId } })
      aplicadas.push(nome)
    } catch {
      // o AC devolve erro quando a tag já está no contato: não é falha
      aplicadas.push(nome)
    }
  }

  return {
    contatoId,
    tagsAplicadas: aplicadas,
    gatilhoAplicado: aplicarGatilho,
  }
}

/**
 * E-mails de todos os contatos que têm uma tag.
 *
 * Uma chamada por TAG, não por contato: é o que permite montar a situação da
 * régua para a base inteira em poucas requisições. Pagina de 100 em 100 porque
 * o ActiveCampaign não devolve mais que isso de uma vez.
 */
export async function contatosPorTag(nomeDaTag: string): Promise<string[]> {
  const id = await idDaTag(nomeDaTag)
  if (!id) return []

  const emails: string[] = []
  let offset = 0

  // Teto de segurança: 50 páginas (5.000 contatos). Sem ele, uma resposta
  // inesperada da API transformaria isto em laço infinito dentro da função.
  for (let pagina = 0; pagina < 50; pagina++) {
    const r = await ac('GET', `contacts?tagid=${id}&limit=100&offset=${offset}`)
    // O ac() deste arquivo devolve o corpo JÁ desembrulhado. Ler r.json aqui
    // devolvia sempre undefined, e a régua aparecia vazia para todo mundo.
    const lote = (r.contacts ?? []) as Array<{ email?: string }>
    for (const c of lote) if (c.email) emails.push(c.email.toLowerCase())
    if (lote.length < 100) break
    offset += 100
  }

  return emails
}

export function acConfigurado(): boolean {
  return Boolean(token())
}
