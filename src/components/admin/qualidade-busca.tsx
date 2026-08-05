import { Gauge, Lightbulb, VideoOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { topicLabel } from '@/lib/format'
import type { EngagementInsights } from '@/types/search'

/**
 * A régua de leitura da relevância. São similaridades de cosseno do pgvector
 * sobre `text-embedding-3-small`: na prática, acima de 0,60 o trecho responde
 * a dor; entre 0,45 e 0,60 tangencia; abaixo disso a pessoa não reconhece a
 * própria pergunta na resposta.
 */
function faixa(v: number | null): { rotulo: string; classe: string } {
  if (v === null) return { rotulo: 'sem dado', classe: 'text-muted-foreground' }
  if (v >= 0.6) return { rotulo: 'responde bem', classe: 'text-foreground' }
  if (v >= 0.45) return { rotulo: 'tangencia', classe: 'text-foreground' }
  return { rotulo: 'acervo fraco no tema', classe: 'text-destructive' }
}

/**
 * "Dores sem resposta" já mostrava o caso extremo, a busca com zero resultado.
 * O caso comum é mais perigoso: a busca devolve algo, mas fraco, e a pessoa vai
 * embora achando que o acervo não tem, sem reclamar. Estas duas leituras são
 * sobre isso, e a segunda vira pauta de vídeo novo.
 */
export function QualidadeBusca({
  qualidade,
  demanda,
  acervo,
}: {
  qualidade: EngagementInsights['qualidade']
  demanda: EngagementInsights['demanda_por_tema']
  acervo: EngagementInsights['acervo']
}) {
  const f = faixa(qualidade.relevancia_media)

  return (
    <>
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="size-4.5 text-primary" aria-hidden="true" />
              Qualidade da busca
            </CardTitle>
            <CardDescription>O quanto o acervo responde ao que perguntam.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Relevância média</span>
              <span className="tabular-nums">
                <strong className="text-base">{qualidade.relevancia_media ?? '—'}</strong>
                <span className={`ml-2 text-xs ${f.classe}`}>{f.rotulo}</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Pior busca do período</span>
              <strong className="tabular-nums">{qualidade.relevancia_minima ?? '—'}</strong>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Buscas com plano de ação</span>
              <span className="tabular-nums">
                <strong>{qualidade.buscas_com_plano}</strong>
                <span className="text-muted-foreground"> de {qualidade.buscas}</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Buscas sem nenhum resultado</span>
              <strong className="tabular-nums">{qualidade.buscas_sem_resultado}</strong>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="size-4.5 text-primary" aria-hidden="true" />
              Pauta vinda da audiência
            </CardTitle>
            <CardDescription>
              Temas mais buscados, com o quanto o acervo consegue responder. Relevância baixa em
              tema muito buscado é pedido de vídeo novo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {demanda.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem buscas suficientes ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Tema</th>
                      <th className="pb-2 text-right font-medium">Buscas</th>
                      <th className="pb-2 text-right font-medium">Relevância</th>
                      <th className="pb-2 text-right font-medium">Trechos no acervo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demanda.map((t) => {
                      const ft = faixa(t.relevancia_media)
                      return (
                        <tr key={t.topico} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-3">{topicLabel(t.topico)}</td>
                          <td className="py-2 text-right tabular-nums">{t.buscas}</td>
                          <td className="py-2 text-right tabular-nums">
                            <span className={ft.classe}>{t.relevancia_media ?? '—'}</span>
                          </td>
                          <td className="py-2 text-right tabular-nums text-muted-foreground">
                            {t.trechos_no_acervo}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <VideoOff className="size-4.5 text-primary" aria-hidden="true" />
            Acervo ocioso
          </CardTitle>
          <CardDescription>
            Vídeos indexados que a busca nunca recomendou. É conteúdo pronto que não está
            trabalhando: vale rever título, descrição ou os temas atribuídos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant="secondary" className="tabular-nums">
              {acervo.indexados} indexados
            </Badge>
            <Badge variant="secondary" className="tabular-nums">
              {acervo.ja_recomendados} já recomendados
            </Badge>
            <Badge variant="outline" className="tabular-nums">
              {acervo.nunca_recomendados} nunca recomendados
            </Badge>
          </div>

          {acervo.amostra.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todo vídeo indexado já foi recomendado ao menos uma vez.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {acervo.amostra.map((v) => (
                <li key={v.video_id} className="flex gap-3">
                  {v.thumbnail_url && (
                    <img
                      src={v.thumbnail_url}
                      alt=""
                      loading="lazy"
                      className="h-12 w-20 shrink-0 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm leading-snug">{v.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{v.trechos} trechos</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}
