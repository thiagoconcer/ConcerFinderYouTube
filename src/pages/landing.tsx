import { Link } from 'react-router-dom'
import { ArrowRight, Clock, ListChecks, Search, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { ROUTES } from '@/lib/routes'

const HOW_IT_WORKS = [
  {
    icon: Search,
    title: '1. Descreva a dor',
    description:
      'Escreva com as suas palavras o problema de vendas que você está enfrentando. Sem precisar adivinhar a palavra-chave certa.',
  },
  {
    icon: Sparkles,
    title: '2. Busca por significado',
    description:
      'O ConcerFinder entende o sentido do que você escreveu e varre a transcrição de todos os vídeos do canal, não só os títulos.',
  },
  {
    icon: Clock,
    title: '3. Vídeo, minuto e plano',
    description:
      'Você recebe quais vídeos assistir, o minuto exato onde está cada insight e um plano de ação para aplicar.',
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
      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-6">
              Acervo do canal do Thiago Concer
            </Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Descreva sua dor de vendas e receba o vídeo e o{' '}
              <span className="text-muted-foreground">minuto exato</span> onde o Concer resolve.
            </h1>
            <p className="mt-6 text-pretty text-lg text-muted-foreground">
              São centenas de vídeos sobre vendas. O ConcerFinder encontra, dentro deles, o
              trecho que responde exatamente ao seu problema — e ainda monta um plano de ação
              para você aplicar hoje.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to={primaryCta.to}>
                  {primaryCta.label}
                  <ArrowRight />
                </Link>
              </Button>
              {!isAuthenticated && (
                <Button asChild size="lg" variant="ghost">
                  <Link to={ROUTES.login}>Já tenho conta</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Problema */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              O insight que você precisa está lá. No meio de um vídeo de 40 minutos.
            </h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              A busca do YouTube funciona por palavra-chave: ela olha título e descrição. Se o
              Concer destrinchou a sua objeção no minuto 27 de um vídeo com outro nome, você
              nunca vai achar.
            </p>
            <p>
              O ConcerFinder transcreve o canal inteiro e indexa cada trecho por significado. Você
              descreve a situação real do seu dia a dia comercial e ele te leva direto ao ponto.
            </p>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Como funciona</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <Card key={step.title}>
                <CardHeader>
                  <step.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Exemplos de dores */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Dores que você pode pesquisar
          </h2>
          <p className="mt-3 text-muted-foreground">
            Escreva como você falaria com um colega. É assim que a busca funciona melhor.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PAIN_EXAMPLES.map((pain) => (
              <li
                key={pain}
                className="rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground"
              >
                “{pain}”
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Prova social + CTA final */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-xl border bg-card p-8 sm:p-12">
            <ListChecks className="size-6 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Todo o conteúdo do maior nome de vendas do Brasil, pesquisável por dor.
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Thiago Concer é a maior referência em vendas do Brasil. O ConcerFinder organiza esse
              acervo para vendedores, gestores comerciais e donos de empresa acharem resposta em
              segundos. O cadastro é gratuito e libera a busca na hora.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link to={primaryCta.to}>
                {primaryCta.label}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
