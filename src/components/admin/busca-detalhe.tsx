import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { ROUTES } from '@/lib/routes'
import { formatDateTime, formatTimestamp } from '@/lib/format'
import type { BuscaDetalheDados } from '@/types/leads'

/**
 * O que a pessoa recebeu naquela busca, exatamente: a pergunta de contexto que
 * o sistema fez, o que ela respondeu, o plano como saiu e os trechos na ordem
 * em que apareceram, marcando quais ela abriu.
 *
 * Carrega ao abrir, uma busca por vez. A lista do perfil traz dezenas delas, e
 * o plano de cada uma tem alguns milhares de caracteres: trazer tudo junto
 * seria pesar a ficha inteira por um dado que se lê um de cada vez.
 *
 * O plano aparece como texto puro, sem a formatação da tela da pessoa, de
 * propósito: aqui a pergunta da equipe é "o que o modelo escreveu para ela",
 * então o que vale é o conteúdo cru, incluindo o marcador da seção de IA.
 */
export function BuscaDetalhe({ searchId }: { searchId: string }) {
  const [dados, setDados] = useState<BuscaDetalheDados | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let ativo = true
    void (async () => {
      const { data, error } = await supabase.rpc('get_busca_detail', { p_search_id: searchId })
      if (!ativo) return
      if (error) {
        setErro(true)
        return
      }
      setDados(data as unknown as BuscaDetalheDados)
    })()
    return () => {
      ativo = false
    }
  }, [searchId])

  if (erro) {
    return (
      <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">
        Não foi possível carregar esta busca.
      </p>
    )
  }

  if (!dados) {
    return (
      <div className="mt-3 space-y-2 border-t pt-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    )
  }

  const { contexto, trechos, busca } = dados

  return (
    <div className="mt-3 space-y-5 border-t pt-3">
      {contexto.pergunta && (
        <section>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contexto que o sistema pediu
          </h4>
          <p className="text-sm">{contexto.pergunta}</p>
          {contexto.opcoes.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Opções oferecidas: {contexto.opcoes.join(' · ')}
            </p>
          )}
          {contexto.resposta ? (
            <p className="mt-2 rounded-lg bg-muted/50 p-2.5 text-sm">
              <span className="text-muted-foreground">Respondeu:</span> {contexto.resposta}
              {contexto.respondida_em && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {formatDateTime(contexto.respondida_em)}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Não respondeu.</p>
          )}
        </section>
      )}

      <section>
        <h4 className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Plano que ela recebeu
          {busca.plano_com_contexto && (
            <Badge variant="outline" className="font-normal normal-case">
reescrito com o contexto
            </Badge>
          )}
        </h4>
        {busca.plano ? (
          <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
            {busca.plano}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">O plano não chegou a ser gerado.</p>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Trechos entregues ({trechos.length})
        </h4>
        <ul className="space-y-2">
          {trechos.map((t) => (
            <li key={`${t.video_id}-${t.inicio_segundos}`} className="flex items-start gap-2">
              {t.abriu ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-label="abriu"
                />
              ) : (
                <Circle
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground/40"
                  aria-label="não abriu"
                />
              )}
              <div className="min-w-0">
                <Link
                  to={`${ROUTES.video(t.video_id)}?t=${t.inicio_segundos}`}
                  className="text-sm hover:underline"
                >
                  {t.titulo}
                </Link>
                <p className="text-xs text-muted-foreground">
                  minuto {formatTimestamp(t.inicio_segundos)} · relevância{' '}
                  {Math.round(t.relevancia * 100)}%
                </p>
                {t.trecho && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">“{t.trecho}”</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
