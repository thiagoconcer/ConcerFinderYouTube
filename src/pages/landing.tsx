import { Link } from 'react-router-dom'
import { ArrowRight, Clock, ListChecks, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { ROUTES } from '@/lib/routes'

// O número vem do índice, renderizado em azul no card. Não repetir no título.
const HOW_IT_WORKS = [
  {
    icon: Search,
    title: 'Descreva a dor',
    description:
      'Escreva com as suas palavras o problema de vendas que você está enfrentando. Sem precisar adivinhar a palavra-chave certa.',
  },
  {
    icon: Sparkles,
    title: 'Busca por significado',
    description:
      'O ConcerFinder entende o sentido do que você escreveu e varre a transcrição de todos os vídeos do canal, não só os títulos.',
  },
  {
    icon: Clock,
    title: 'Vídeo, minuto e plano',
    description:
      'Você recebe quais vídeos assistir, o vídeo abre no minuto exato do insight e vem um plano de ação para a sua semana.',
  },
]

const PAIN_EXAMPLES = [
  'Meu time não contorna objeção de preço',
  'Não sei estruturar minha prospecção',
  'Meus vendedores não fazem follow-up',
  'O cliente some depois da proposta',
  'Não consigo montar uma meta que o time compre',
  'Minha taxa de conversão caiu e não sei por quê',
]

export function LandingPage() {
  const { isAuthenticated } = useAuth()

  const primaryCta = isAuthenticated
    ? { label: 'Ir para a busca', to: ROUTES.busca }
    : { label: 'Criar conta grátis', to: ROUTES.cadastro }

  return (
    <>
      {/*
        Hero em banda navy, o visual assinatura da marca. Fica navy nos dois
        temas de propósito: é a "foto de palco" da LP, o ponto onde a marca se
        apresenta. O ritmo vertical vem da alternância com as bandas claras.
      */}
      <section className="banda-navy relative overflow-hidden border-b border-white/10 lg:min-h-[660px]">
        <div className="mx-auto grid w-full max-w-[1180px] items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:min-h-[660px] lg:grid-cols-[minmax(0,540px)_minmax(0,1fr)] lg:gap-12 lg:py-24">
          {/* No desktop texto e foto dividem a mesma coluna de 1180: o texto na
              esquerda, a foto na direita, dentro da grade. No mobile empilha e a
              foto vira faixa embaixo. */}
          <div className="max-w-3xl lg:max-w-[540px]">
            <span className="eyebrow mb-6">Acervo do canal do Thiago Concer</span>
            <h1 className="text-[clamp(32px,4.6vw,58px)] font-semibold text-white">
              Descreva sua dor de vendas e receba o vídeo e o{' '}
              <span className="text-primary">minuto exato</span> onde Thiago Concer resolve.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-[#C6D2E6]">
              O ConcerFinder varre o canal inteiro, acha o trecho que responde ao seu problema,
              abre o vídeo naquele minuto e monta um plano de ação para você aplicar esta
              semana.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to={primaryCta.to}>
                  {primaryCta.label}
                  <ArrowRight />
                </Link>
              </Button>
              {!isAuthenticated && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <Link to={ROUTES.login}>Já tenho conta</Link>
                </Button>
              )}
            </div>
            <p className="mt-6 text-sm text-[#B5C2D8]">
              Cadastro gratuito. Libera a busca na hora.
            </p>
          </div>

          {/*
            Uma imagem só, dois lugares.
            No mobile ela fica no fluxo, logo abaixo do texto, como fecho da
            faixa. No desktop ocupa a coluna da direita da grade, alinhada com o
            texto e sem sangrar até a borda da tela: assim ela fica dentro do
            bloco de conteúdo em vez de fugir para o canto. O olhar dele aponta
            para a esquerda, então puxa a leitura de volta para o título.

            Os degradês existem porque o fundo da foto é navy, mas não exatamente
            o #0A1628 da faixa: sem eles a emenda aparece como um retângulo.
          */}
          <div
            className="relative mx-auto h-[340px] w-full max-w-[440px] sm:h-[400px] lg:h-[560px] lg:max-w-[480px]"
            aria-hidden="true"
          >
            <picture>
              <source media="(min-width: 1024px)" srcSet="/thiago-concer-palco.webp" />
              <img
                src="/thiago-concer-palco-mobile.webp"
                alt=""
                className="size-full object-cover object-[60%_6%] lg:object-[50%_top]"
              />
            </picture>
            {/* Mobile: desmancha em cima e embaixo. Desktop: desmancha no pé,
                onde o corte no tronco apareceria. */}
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#0A1628_0%,rgba(10,22,40,0)_22%,rgba(10,22,40,0)_58%,#0A1628_100%)] lg:bg-[linear-gradient(to_bottom,rgba(10,22,40,0)_52%,rgba(10,22,40,0.82)_86%,#0A1628_100%)]" />
            {/* Desktop: vinheta que dissolve as laterais e o topo na faixa. */}
            <div className="absolute inset-0 hidden lg:block lg:bg-[radial-gradient(74%_66%_at_50%_36%,rgba(10,22,40,0)_60%,#0A1628_100%)]" />
          </div>
        </div>
      </section>

      {/* Problema */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto grid w-full max-w-[1180px] gap-8 px-5 py-[clamp(64px,8vw,116px)] sm:px-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="eyebrow mb-4">Por que existe</span>
            <h2 className="text-[clamp(25px,3.4vw,42px)] font-semibold">
              A resposta já está gravada. O que faltava era chegar nela na hora certa.
            </h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Você descreve a situação real do seu dia a dia comercial, com as suas palavras, sem
              precisar adivinhar a palavra-chave que alguém usou num título.
            </p>
            <p>
              O canal inteiro está transcrito e indexado por significado. O ConcerFinder acha o
              trecho que trata do seu caso, abre o vídeo naquele minuto e monta um plano de ação
              para a sua semana.
            </p>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-[clamp(64px,8vw,116px)] sm:px-8">
          <span className="eyebrow mb-4">Como funciona</span>
          <h2 className="text-[clamp(25px,3.4vw,42px)] font-semibold">Três passos, nada mais</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <Card key={step.title} className="sombra-card">
                <CardHeader>
                  <span className="mb-1 inline-flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <step.icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <CardTitle className="text-xl">
                    <span className="mr-1.5 font-bold tabular-nums text-primary">{i + 1}.</span>
                    {step.title}
                  </CardTitle>
                  <CardDescription className="text-[15px] leading-relaxed">
                    {step.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Exemplos de dores */}
      <section className="border-b bg-muted/40">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-[clamp(64px,8vw,116px)] sm:px-8">
          <span className="eyebrow mb-4">Exemplos</span>
          <h2 className="text-[clamp(25px,3.4vw,42px)] font-semibold">
            Dores que você pode pesquisar
          </h2>
          <p className="mt-3 max-w-2xl text-[17px] text-muted-foreground">
            Escreva como você falaria com um colega. É assim que a busca funciona melhor.
          </p>
          {/* Clicar na dor que é a sua é o gatilho de conversão mais forte
              da página: cada uma leva ao cadastro (ou à busca, se logado) com
              a dor já preenchida e pronta para rodar. */}
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PAIN_EXAMPLES.map((pain) => (
              <li key={pain}>
                <Link
                  to={`${isAuthenticated ? ROUTES.busca : ROUTES.cadastro}?q=${encodeURIComponent(pain)}`}
                  className="sombra-card block rounded-lg border bg-card px-4 py-3.5 text-[15px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  “{pain}”
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Prova social + CTA final, fechando em banda navy como a LP */}
      <section className="banda-navy">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-[clamp(64px,8vw,116px)] sm:px-8">
          <ListChecks className="size-6 text-primary" aria-hidden="true" />
          <h2 className="mt-4 max-w-3xl text-[clamp(25px,3.4vw,42px)] font-semibold text-white">
            20 anos de vendas, respondendo na hora em que você precisa.
          </h2>
          <p className="mt-4 max-w-2xl text-[17px] text-[#C6D2E6]">
            Thiago Concer é a maior referência em vendas do Brasil, e o canal dele sempre foi
            aberto. O ConcerFinder é como você chega no trecho certo no momento em que a dor
            aperta, seja você vendedor, gestor comercial ou dono de empresa. O cadastro é gratuito
            e libera a busca na hora.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to={primaryCta.to}>
              {primaryCta.label}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </>
  )
}
