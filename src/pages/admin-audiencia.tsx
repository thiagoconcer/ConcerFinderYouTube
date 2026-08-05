import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, RefreshCw, Users } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Ativacao } from '@/components/admin/ativacao'
import { Cargos } from '@/components/admin/cargos'
import { Crescimento } from '@/components/admin/crescimento'
import { QualidadeBusca } from '@/components/admin/qualidade-busca'
import { GestaoEquipe } from '@/components/admin/gestao-equipe'
import { PerfisPorTema } from '@/components/admin/perfis-por-tema'
import { RankingTrechos } from '@/components/admin/ranking-trechos'
import { supabase } from '@/lib/supabase'
import { formatDateTime, topicLabel } from '@/lib/format'
import { COMMERCIAL_ROLE_LABELS } from '@/types/database'
import type { CommercialRole, Lead } from '@/types/database'
import type { AudienceInsights, CargoInsights, EngagementInsights } from '@/types/search'

/**
 * /admin/audiencia
 * Painel do Gestor de audiência: leads, perfis e ranking de dores buscadas.
 * Os agregados vêm da RPC get_audience_insights (staff-only, SECURITY DEFINER);
 * a tabela de leads vem direto da tabela, protegida por leads_select_staff.
 */

const NURTURE_LABEL: Record<string, string> = {
  pending: 'Pendente',
  sent: 'Enviado',
  failed: 'Falhou',
}

const TODOS = 'todos'

export function AdminAudienciaPage() {
  const [insights, setInsights] = useState<AudienceInsights | null>(null)
  const [cargos, setCargos] = useState<CargoInsights | null>(null)
  const [engajamento, setEngajamento] = useState<EngagementInsights | null>(null)
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [filtroPerfil, setFiltroPerfil] = useState<string>(TODOS)

  const carregar = useCallback(async () => {
    setErro(null)
    setInsights(null)
    setCargos(null)
    setEngajamento(null)
    setLeads(null)

    const perfil = filtroPerfil === TODOS ? null : filtroPerfil

    let leadsQuery = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (perfil) leadsQuery = leadsQuery.eq('commercial_role', perfil)

    // O corte por cargo não usa o filtro de perfil: ele é justamente a visão
    // mais fina, e filtrar por perfil deixaria só os cargos daquele grupo.
    const [insightsRes, cargosRes, engajamentoRes, leadsRes] = await Promise.all([
      supabase.rpc(
        'get_audience_insights',
        perfil ? { filter_commercial_role: perfil } : {},
      ),
      supabase.rpc('get_cargo_insights', {}),
      supabase.rpc('get_engagement_insights', {}),
      leadsQuery,
    ])

    if (insightsRes.error || leadsRes.error) {
      setErro('Não foi possível carregar os insights de audiência.')
    }
    setInsights((insightsRes.data as unknown as AudienceInsights) ?? null)
    setCargos((cargosRes.data as unknown as CargoInsights) ?? null)
    setEngajamento((engajamentoRes.data as unknown as EngagementInsights) ?? null)
    setLeads(leadsRes.data ?? [])
  }, [filtroPerfil])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const carregando = insights === null && leads === null
  const semDados =
    !carregando && (insights?.totais.leads ?? 0) === 0 && (insights?.totais.buscas ?? 0) === 0

  const maiorTema = insights?.temas?.[0]?.total ?? 1

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-10 sm:px-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Audiência e leads</h1>
          <p className="mt-2 text-muted-foreground">
            Quem se cadastrou, qual o perfil comercial e quais dores concentram interesse.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filtroPerfil} onValueChange={setFiltroPerfil}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Todos os perfis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os perfis</SelectItem>
              {(Object.keys(COMMERCIAL_ROLE_LABELS) as CommercialRole[]).map((papel) => (
                <SelectItem key={papel} value={papel}>
                  {COMMERCIAL_ROLE_LABELS[papel]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void carregar()}>
            <RefreshCw />
            Atualizar
          </Button>
        </div>
      </header>

      {erro && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>
            {erro}
            <Button variant="outline" size="sm" onClick={() => void carregar()}>
              Recarregar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Só o admin enxerga; o componente se esconde sozinho */}
      <GestaoEquipe />

      {carregando && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {semDados && (
        <Card>
          <CardContent className="py-14 text-center">
            <Users className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="font-medium">Sem dados de audiência ainda</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Os insights aparecem conforme os usuários se cadastram e buscam suas dores.
            </p>
          </CardContent>
        </Card>
      )}

      {!carregando && !semDados && insights && (
        <>
          {/* Indicadores */}
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { rotulo: 'Leads cadastrados', valor: insights.totais.leads },
              { rotulo: 'Buscas no período', valor: insights.totais.buscas },
              { rotulo: 'Trechos abertos', valor: insights.totais.visualizacoes },
              { rotulo: 'Vídeos indexados', valor: insights.totais.videos_indexados },
            ].map((item) => (
              <Card key={item.rotulo}>
                <CardHeader>
                  <CardDescription>{item.rotulo}</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{item.valor}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </section>

          {/* Estamos crescendo? A pergunta que o painel não respondia. */}
          {engajamento && <Crescimento serie={engajamento.serie} />}

          {/* Cadastro que não vira busca é e-mail, não lead qualificado. */}
          {engajamento && (
            <Ativacao
              funil={engajamento.funil}
              qualidade={engajamento.qualidade}
              recorrencia={engajamento.recorrencia}
            />
          )}

          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            {/* Ranking de dores */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dores mais buscadas</CardTitle>
                <CardDescription>
                  Base da segmentação para parcerias com empresas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {insights.temas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum tema detectado ainda.</p>
                ) : (
                  <ul className="space-y-3">
                    {insights.temas.slice(0, 12).map((tema) => (
                      <li key={tema.topico}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                          <span className="truncate">{topicLabel(tema.topico)}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {tema.total}
                          </span>
                        </div>
                        <div
                          className="h-1.5 overflow-hidden rounded-full bg-muted"
                          role="presentation"
                        >
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(4, (tema.total / maiorTema) * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {/* Distribuição por perfil */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Leads por perfil comercial</CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.leads_por_perfil.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum lead ainda.</p>
                  ) : (
                    <ul className="space-y-2">
                      {insights.leads_por_perfil.map((linha) => (
                        <li key={linha.commercial_role} className="flex justify-between text-sm">
                          <span>
                            {COMMERCIAL_ROLE_LABELS[linha.commercial_role as CommercialRole] ??
                              linha.commercial_role}
                          </span>
                          <span className="tabular-nums text-muted-foreground">{linha.total}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Saúde da nutrição */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Régua de nutrição</CardTitle>
                  <CardDescription>Status de entrega por e-mail e WhatsApp.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {Object.keys(insights.nutricao).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem disparos ainda.</p>
                  ) : (
                    Object.entries(insights.nutricao).map(([status, total]) => (
                      <Badge
                        key={status}
                        variant={
                          status === 'sent'
                            ? 'default'
                            : status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {NURTURE_LABEL[status] ?? status}: {total}
                      </Badge>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Quem procura o quê */}
          <section className="mb-8 space-y-6">
            <PerfisPorTema perfis={insights.perfis_por_tema ?? []} />

            <Cargos dados={cargos} />
          </section>

          {/* O acervo dá conta do que perguntam? E o que sobrou sem uso? */}
          {engajamento && (
            <QualidadeBusca
              qualidade={engajamento.qualidade}
              demanda={engajamento.demanda_por_tema}
              acervo={engajamento.acervo}
            />
          )}

          {/* O que a busca devolve x o que as pessoas abrem */}
          <section className="mb-8 grid gap-6 lg:grid-cols-2">
            <RankingTrechos
              titulo="Trechos mais recomendados"
              descricao="O que a busca semântica mais devolveu para as dores pesquisadas."
              trechos={insights.trechos_mais_recomendados ?? []}
              tipo="recomendado"
            />
            <RankingTrechos
              titulo="Trechos mais assistidos"
              descricao="O que as pessoas realmente abriram. A diferença para a coluna ao lado mostra o que recomenda bem mas não convence a clicar."
              trechos={insights.trechos_mais_assistidos ?? []}
              tipo="assistido"
            />
          </section>

          {/* Vídeos com melhor desempenho */}
          {(insights.videos_mais_recomendados ?? []).length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg">Vídeos que mais aparecem</CardTitle>
                <CardDescription>
                  Recomendações e aberturas por vídeo. Bom para escolher o que repostar e sobre o
                  que gravar mais.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="border-b text-left">
                      <tr>
                        <th className="pb-2 font-medium">Vídeo</th>
                        <th className="pb-2 text-right font-medium">Recomendado</th>
                        <th className="pb-2 text-right font-medium">Aberto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.videos_mais_recomendados.map((v) => (
                        <tr key={v.video_id} className="border-b last:border-0">
                          <td className="max-w-md truncate py-2.5 pr-4">{v.title}</td>
                          <td className="py-2.5 text-right tabular-nums">{v.recomendacoes}</td>
                          <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                            {v.visualizacoes}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Buscas sem resultado: pauta de conteúdo */}
          {insights.buscas_sem_resultado.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg">Dores sem resposta no acervo</CardTitle>
                <CardDescription>
                  Buscas que não encontraram trecho relevante. Pauta pronta para novos vídeos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {insights.buscas_sem_resultado.map((b, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">“{b.query_text}”</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDateTime(b.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Tabela de leads */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">Leads</h2>
            {leads && leads.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b bg-muted/40 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Nome</th>
                      <th className="px-4 py-3 font-medium">E-mail</th>
                      <th className="px-4 py-3 font-medium">WhatsApp</th>
                      <th className="px-4 py-3 font-medium">Perfil</th>
                      <th className="px-4 py-3 font-medium">Nutrição</th>
                      <th className="px-4 py-3 font-medium">Cadastro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id} className="border-b last:border-0">
                        <td className="px-4 py-3">{lead.full_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.email}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.whatsapp}</td>
                        <td className="px-4 py-3">
                          {COMMERCIAL_ROLE_LABELS[lead.commercial_role as CommercialRole] ??
                            lead.commercial_role}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              lead.nurture_status === 'sent'
                                ? 'default'
                                : lead.nurture_status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {NURTURE_LABEL[lead.nurture_status] ?? lead.nurture_status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDateTime(lead.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum lead para o filtro selecionado.
                </CardContent>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  )
}
