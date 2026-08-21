/**
 * Grava o ConcerFinder de verdade para o story: login, busca, trechos e plano.
 *
 * Por que gravar o sistema em vez de animar uma simulação: a simulação acerta o
 * layout e erra o que convence, que é o tempo real das coisas acontecendo, o
 * cursor piscando de verdade e o resultado que o próprio produto devolveu.
 *
 * A conta usada é interna (@thiagoconcer.com.br), então a busca gravada não
 * entra em nenhum relatório do painel.
 *
 * Saída: gravacao.webm e marcos.json, com os instantes de cada etapa para o
 * corte acelerar só a espera do plano, que leva ~30s e não cabe num story.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const AQUI = dirname(fileURLToPath(import.meta.url))
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SITE = 'https://finder.thiagoconcer.com.br'
const EMAIL = 'qa.video@thiagoconcer.com.br'
const SENHA = 'GravacaoStory!2608'
const DOR = 'meu time trava quando o cliente diz que tá caro'

const marcos = {}
const t0 = () => Date.now()
let inicio = 0
const marcar = (nome) => { marcos[nome] = Date.now() - inicio }

const navegador = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--hide-scrollbars', '--force-device-scale-factor=2', '--window-size=540,960'],
  defaultViewport: { width: 540, height: 960, deviceScaleFactor: 2 },
})

try {
  const pagina = await navegador.newPage()

  // login antes de começar a gravar: senha na tela não entra no story
  await pagina.goto(`${SITE}/login`, { waitUntil: 'networkidle2' })
  await pagina.type('#email', EMAIL, { delay: 20 })
  await pagina.type('#password', SENHA, { delay: 20 })
  await Promise.all([
    pagina.click('button[type="submit"]'),
    pagina.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
  ])
  await pagina.goto(`${SITE}/busca`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1200))

  const gravacao = await pagina.screencast({ path: join(AQUI, 'gravacao.webm') })
  inicio = t0()

  await new Promise((r) => setTimeout(r, 900))
  marcar('digitacao')
  // 45ms por tecla: ritmo de quem digita de verdade, não de robô
  await pagina.type('textarea', DOR, { delay: 45 })
  await new Promise((r) => setTimeout(r, 700))

  marcar('clique')
  await pagina.click('button[type="submit"]')

  // os trechos chegam primeiro, o plano depois: são duas esperas diferentes
  await pagina.waitForSelector('a[href*="/video/"]', { timeout: 60_000 })
  marcar('trechos')
  await new Promise((r) => setTimeout(r, 1500))

  await pagina.evaluate(() => window.scrollTo({ top: 260, behavior: 'smooth' }))
  await new Promise((r) => setTimeout(r, 1400))

  await pagina.waitForFunction(
    () => !document.body.innerText.includes('Consolidando os insights'),
    { timeout: 120_000 },
  )
  marcar('plano')

  // o story mostra a busca e o plano, e só. O convite do Viver de IA sai da tela
  // antes da descida: o vídeo é sobre o que a ferramenta entrega, e um convite
  // comercial no meio dele muda o assunto da peça.
  await pagina.evaluate(() => {
    document
      .querySelectorAll('div[class*="border-primary/25"]')
      .forEach((bloco) => bloco.remove())
  })
  await new Promise((r) => setTimeout(r, 900))

  // o plano é o que a pessoa leva pra semana, então ele precisa aparecer inteiro:
  // uma descida em degraus, com pausa pra dar tempo de bater o olho em cada bloco
  await pagina.evaluate(() => {
    const alvo = [...document.querySelectorAll('h2, h3')].find((e) =>
      e.textContent.includes('Seu plano de ação'),
    )
    alvo?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
  await new Promise((r) => setTimeout(r, 1400))
  marcar('plano_topo')

  for (let i = 0; i < 9; i += 1) {
    await pagina.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }))
    await new Promise((r) => setTimeout(r, 750))
  }
  await new Promise((r) => setTimeout(r, 700))
  marcar('fim')

  await gravacao.stop()
  writeFileSync(join(AQUI, 'marcos.json'), JSON.stringify(marcos, null, 2))
  console.log('marcos (ms):', marcos)
} finally {
  await navegador.close()
}
