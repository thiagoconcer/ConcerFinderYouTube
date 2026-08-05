import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ChevronDown, ChevronUp, RotateCcw, Search } from 'lucide-react'
import { ActionPlan } from '@/components/action-plan'
import { ResultCard } from '@/components/result-card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { ROUTES } from '@/lib/routes'
import { formatDateTime, topicLabel } from '@/lib/format'
import { CARGO_LABELS } from '@/types/database'
import type { Cargo, Search as SearchRow } from '@/types/database'
import type { SearchHit, SearchResultRow } from '@/types/search'

/**
 * /busca/historico
 * Buscas anteriores. Por padrão, SÓ as do próprio usuário.
 *
 * A RLS de `searches` libera staff a ler tudo, então sem o filtro explícito
 * quem é da equipe via o histórico da base inteira misturado com o próprio,
 * sem ter pedido. Ver as buscas dos outros é uma ação deliberada, então virou
 * um seletor separado, visível só para staff.
 *
 * Os resultados persistidos são reabertos pela RPC get_search_results,
 * já que video_segments não é legível direto pelo frontend.
 */

type Escopo = 'minhas' | 'todas'

/** Buscas de outras pessoas vêm com o autor embutido; as próprias, não. */
type BuscaComAutor = SearchRow & {
  profiles?: { full_name: string | null; email: string | null; cargo: string | null } | null
}

export function BuscaHistoricoPage() {
  const { user, isStaff } = useAuth()
  const [escopo, setEscopo] = useState<Escopo>('minhas')
  const [buscas, setBuscas] = useState<BuscaComAutor[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [detalhes, setDetalhes] = useState<Record<string, SearchResultRow[]>>({})
  const [carregandoDetalhe, setCarregandoDetalhe] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setErro(null)
    setBuscas(null)
    const verTodas = escopo === 'todas' && isStaff
    let consulta = supabase
      .from('searches')
      .select(verTodas ? '*, profiles(full_name, email, cargo)' : '*')
      .order('created_at', { ascending: false })
      .limit(50)

    // Sem este filtro a RLS entrega a base inteira para quem é staff.
    if (!verTodas) {
      if (!user?.id) return
      consulta = consulta.eq('profile_id', user.id)
    }

    const { data, error } = await consulta

    if (error) {
      setErro('Não foi possível carregar o histórico.')
      setBuscas([])
      return
    }
    setBuscas((data ?? []) as unknown as BuscaComAutor[])
  }, [escopo, isStaff, user?.id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function abrir(searchId: string) {
    if (aberta === searchId) {
      setAberta(null)
      return
    }
    setAberta(searchId)

    if (detalhes[searchId]) return

    setCarregandoDetalhe(searchId)
    const { data, error } = await supabase.rpc('get_search_results', { p_search_id: searchId })
    setCarregandoDetalhe(null)
    if (error) {
      setErro('Não foi possível carregar os resultados dessa busca.')
      return
    }
    setDetalhes((atual) => ({ ...atual, [searchId]: (data ?? []) as unknown as SearchResultRow[] }))
  }

  // Chips de temas recorrentes, montados a partir do próprio histórico
  const temasRecorrentes = [
    ...new Set((buscas ?? []).flatMap((b) => b.detected_topics ?? [])),
  ].slice(0, 10)

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {escopo === 'todas' ? 'Buscas de todas as pessoas' : 'Suas buscas'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {escopo === 'todas'
              ? 'O que a audiência inteira pesquisou. Visão da equipe Concer.'
              : 'Tudo o que você já pesquisou, com os temas identificados em cada dor.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Só staff enxerga o seletor. Ver a busca dos outros é uma ação
              deliberada, nunca o padrão de quem abre a própria página. */}
          {isStaff && (
            <Select value={escopo} onValueChange={(v) => setEscopo(v as Escopo)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minhas">Minhas buscas</SelectItem>
                <SelectItem value="todas">Todas as pessoas</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button asChild>
            <Link to={ROUTES.busca}>
              <Search />
              Nova busca
            </Link>
          </Button>
        </div>
      </header>

      {erro && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle />
          <AlertTitle>Algo deu errado</AlertTitle>
          <AlertDescription>
            {erro}
            <Button variant="outline" size="sm" onClick={() => void carregar()}>
              Recarregar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Carregando */}
      {buscas === null && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {/* Vazio */}
      {buscas !== null && buscas.length === 0 && !erro && (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="font-medium">Você ainda não fez nenhuma busca</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Descreva uma dor de vendas e o ConcerFinder mostra em quais vídeos, e em quais
              minutos, o Concer resolve.
            </p>
            <Button asChild className="mt-6">
              <Link to={ROUTES.busca}>Fazer minha primeira busca</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      {buscas !== null && buscas.length > 0 && (
        <>
          {temasRecorrentes.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                Temas que você mais pesquisa
              </h2>
              <ul className="flex flex-wrap gap-2">
                {temasRecorrentes.map((tema) => (
                  <li key={tema}>
                    <Badge variant="secondary">{topicLabel(tema)}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ul className="space-y-4">
            {buscas.map((busca) => {
              const estaAberta = aberta === busca.id
              const resultados = detalhes[busca.id]

              return (
                <li key={busca.id}>
                  <Card>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="text-balance text-base leading-snug">
                            “{busca.query_text}”
                          </CardTitle>
                          <p className="mt-1.5 text-sm text-muted-foreground">
                            {formatDateTime(busca.created_at)}
                            {/* Sem o autor, a lista de todas as pessoas vira um
                                amontoado de frases sem dono. */}
                            {escopo === 'todas' && busca.profiles && (
                              <>
                                {' · '}
                                <span className="text-foreground">
                                  {busca.profiles.full_name || busca.profiles.email}
                                </span>
                                {busca.profiles.cargo && (
                                  <> ({CARGO_LABELS[busca.profiles.cargo as Cargo] ?? busca.profiles.cargo})</>
                                )}
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button variant="outline" size="sm" onClick={() => void abrir(busca.id)}>
                            {estaAberta ? <ChevronUp /> : <ChevronDown />}
                            {estaAberta ? 'Fechar' : 'Ver resultados'}
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              to={`${ROUTES.busca}?q=${encodeURIComponent(busca.query_text)}`}
                            >
                              <RotateCcw />
                              Repetir
                            </Link>
                          </Button>
                        </div>
                      </div>

                      {(busca.detected_topics ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {(busca.detected_topics ?? []).map((tema) => (
                            <Badge key={tema} variant="outline" className="text-xs">
                              {topicLabel(tema)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardHeader>

                    {estaAberta && (
                      <CardContent className="space-y-5 border-t pt-5">
                        {carregandoDetalhe === busca.id && (
                          <div className="space-y-3">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-28 w-full" />
                          </div>
                        )}

                        {busca.action_plan && (
                          <div>
                            <h3 className="mb-3 text-sm font-semibold">Plano de ação</h3>
                            <ActionPlan
                              markdown={busca.action_plan}
                              segments={resultados as SearchHit[] | undefined}
                            />
                          </div>
                        )}

                        {resultados && resultados.length > 0 && (
                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold">
                              {resultados.length} {resultados.length === 1 ? 'trecho' : 'trechos'}
                            </h3>
                            {resultados.map((r) => (
                              <ResultCard key={r.segment_id} hit={r as SearchHit} />
                            ))}
                          </div>
                        )}

                        {resultados && resultados.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Essa busca não encontrou trechos relevantes.
                          </p>
                        )}
                      </CardContent>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
