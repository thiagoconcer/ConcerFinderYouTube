import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Database, Loader2, Play, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import type { ContentDashboard } from '@/types/search'
import type { IngestionRun, Video } from '@/types/database'

/**
 * /admin/conteudo
 * Painel do Administrador de conteúdo: status da esteira de ingestão,
 * tabela de vídeos e log de ingestion_runs. Staff-only (RLS + ProtectedRoute).
 */

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  transcribing: 'Transcrevendo',
  transcribed: 'Transcrito',
  indexed: 'Indexado',
  failed: 'Falhou',
}

/**
 * Separa "não há legenda para transcrever" de "a esteira quebrou".
 *
 * Os dois caem em `failed` no banco, mas significam coisas opostas: um é
 * conteúdo (short curto que o YouTube não legenda) e o outro é problema para
 * investigar. Sem essa distinção, três shorts ficam vermelhos para sempre no
 * painel e escondem uma falha real quando ela aparecer.
 */
function semLegenda(video: { transcription_status: string; duration_seconds: number | null }): boolean {
  return video.transcription_status === 'failed' && (video.duration_seconds ?? 0) <= 90
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  indexed: 'default',
  transcribed: 'secondary',
  transcribing: 'secondary',
  pending: 'outline',
  failed: 'destructive',
}

type Etapa = 'scrape-youtube-channel' | 'transcribe-videos' | 'index-segments'

export function AdminConteudoPage() {
  const [painel, setPainel] = useState<ContentDashboard | null>(null)
  const [videos, setVideos] = useState<Video[] | null>(null)
  const [execucoes, setExecucoes] = useState<IngestionRun[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, setRodando] = useState<Etapa | null>(null)

  const carregar = useCallback(async () => {
    setErro(null)
    const [painelRes, videosRes, runsRes] = await Promise.all([
      supabase.rpc('get_content_dashboard'),
      supabase
        .from('videos')
        .select('*')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(100),
      supabase.from('ingestion_runs').select('*').order('started_at', { ascending: false }).limit(20),
    ])

    if (painelRes.error || videosRes.error || runsRes.error) {
      setErro('Não foi possível carregar os dados de ingestão.')
    }
    setPainel((painelRes.data as unknown as ContentDashboard) ?? null)
    setVideos(videosRes.data ?? [])
    setExecucoes(runsRes.data ?? [])
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function rodarEtapa(etapa: Etapa) {
    setRodando(etapa)
    try {
      const { data, error } = await supabase.functions.invoke(etapa, { body: {} })
      if (error) {
        let mensagem = 'Falha ao executar a etapa.'
        const contexto = (error as { context?: Response }).context
        if (contexto?.json) {
          try {
            const corpo = await contexto.json()
            mensagem = corpo?.error ?? mensagem
          } catch {
            // mantém a mensagem padrão
          }
        }
        toast.error(mensagem)
      } else {
        toast.success(`Etapa concluída: ${JSON.stringify(data).slice(0, 120)}`)
      }
    } finally {
      setRodando(null)
      void carregar()
    }
  }

  const carregando = painel === null && videos === null

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-10 sm:px-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Administração de conteúdo</h1>
          <p className="mt-2 text-muted-foreground">
            Status de scraping, transcrição e indexação dos vídeos do canal.
          </p>
        </div>
        <Button variant="outline" onClick={() => void carregar()}>
          <RefreshCw />
          Atualizar
        </Button>
      </header>

      {erro && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Indicadores */}
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {carregando
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)
          : [
              { rotulo: 'Vídeos na base', valor: painel?.total_videos ?? 0 },
              { rotulo: 'Indexados', valor: painel?.videos?.indexed ?? 0 },
              { rotulo: 'Segmentos', valor: painel?.total_segmentos ?? 0 },
              { rotulo: 'Com embedding', valor: painel?.segmentos_com_embedding ?? 0 },
            ].map((item) => (
              <Card key={item.rotulo}>
                <CardHeader>
                  <CardDescription>{item.rotulo}</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{item.valor}</CardTitle>
                </CardHeader>
              </Card>
            ))}
      </section>

      {/* Esteira manual */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Rodar a esteira agora</CardTitle>
          <CardDescription>
            As três etapas também rodam sozinhas todo dia pelo pg_cron. Cada etapa só processa o
            que a anterior deixou pronto.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {(
            [
              ['scrape-youtube-channel', '1. Buscar vídeos do canal'],
              ['transcribe-videos', '2. Transcrever pendentes'],
              ['index-segments', '3. Indexar segmentos'],
            ] as Array<[Etapa, string]>
          ).map(([etapa, rotulo]) => (
            <Button
              key={etapa}
              variant="outline"
              disabled={rodando !== null}
              onClick={() => void rodarEtapa(etapa)}
            >
              {rodando === etapa ? <Loader2 className="animate-spin" /> : <Play />}
              {rotulo}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Vídeos */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Vídeos</h2>
        {carregando ? (
          <Skeleton className="h-64 w-full" />
        ) : videos && videos.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Título</th>
                  <th className="px-4 py-3 font-medium">YouTube ID</th>
                  <th className="px-4 py-3 font-medium">Publicado</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((video) => (
                  <tr key={video.id} className="border-b last:border-0">
                    <td className="max-w-md truncate px-4 py-3">{video.title}</td>
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs text-muted-foreground">
                        {video.youtube_video_id}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {video.published_at ? formatDateTime(video.published_at) : 'sem data'}
                    </td>
                    <td className="px-4 py-3">
                      {/* Vídeo curto sem legenda no YouTube não é defeito da
                          esteira: não existe o que transcrever, e retentar não
                          muda nada. Marcar de vermelho como falha faz a equipe
                          procurar um problema que não existe. */}
                      {semLegenda(video) ? (
                        <Badge
                          variant="outline"
                          title="O YouTube não tem legenda para este vídeo. Nenhuma das quatro estratégias encontrou texto, e repetir não resolve."
                        >
                          Sem legenda
                        </Badge>
                      ) : (
                        <Badge variant={STATUS_VARIANT[video.transcription_status] ?? 'outline'}>
                          {STATUS_LABEL[video.transcription_status] ?? video.transcription_status}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Database className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">Nenhum vídeo indexado ainda</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Rode a primeira ingestão no botão acima para trazer o canal para a base.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Execuções */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Execuções de ingestão</h2>
        {carregando ? (
          <Skeleton className="h-48 w-full" />
        ) : execucoes && execucoes.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Etapa</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Processados</th>
                  <th className="px-4 py-3 font-medium">Início</th>
                  <th className="px-4 py-3 font-medium">Fim</th>
                </tr>
              </thead>
              <tbody>
                {execucoes.map((run) => (
                  <tr key={run.id} className="border-b last:border-0 align-top">
                    <td className="px-4 py-3">{run.run_type}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          run.status === 'completed'
                            ? 'default'
                            : run.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {run.status}
                      </Badge>
                      {run.error_message && (
                        <p className="mt-1.5 max-w-md text-xs text-destructive">
                          {run.error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{run.videos_processed}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(run.started_at)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {run.finished_at ? formatDateTime(run.finished_at) : 'em andamento'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma execução registrada ainda.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
