import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { EngagementInsights } from '@/types/search'

type Ponto = { rotulo: string; cadastros: number; buscas: number; aberturas: number }

/**
 * 90 barras diárias não cabem em tela nem contam nada. Acima de 42 dias a
 * série vira semanal, que é a granularidade em que a tendência aparece.
 */
function agrupar(serie: EngagementInsights['serie']): { pontos: Ponto[]; unidade: string } {
  const dia = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  if (serie.length <= 42) {
    return {
      unidade: 'dia',
      pontos: serie.map((s) => ({
        rotulo: dia(s.dia),
        cadastros: s.cadastros,
        buscas: s.buscas,
        aberturas: s.aberturas,
      })),
    }
  }

  const semanas: Ponto[] = []
  for (let i = 0; i < serie.length; i += 7) {
    const bloco = serie.slice(i, i + 7)
    semanas.push({
      rotulo: dia(bloco[0].dia),
      cadastros: bloco.reduce((a, b) => a + b.cadastros, 0),
      buscas: bloco.reduce((a, b) => a + b.buscas, 0),
      aberturas: bloco.reduce((a, b) => a + b.aberturas, 0),
    })
  }
  return { unidade: 'semana', pontos: semanas }
}

function MiniGrafico({
  titulo,
  pontos,
  campo,
  cor,
}: {
  titulo: string
  pontos: Ponto[]
  campo: keyof Omit<Ponto, 'rotulo'>
  cor: string
}) {
  const valores = pontos.map((p) => p[campo])
  const maior = Math.max(...valores, 1)
  const total = valores.reduce((a, b) => a + b, 0)
  const ultimo = pontos.at(-1)

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{titulo}</span>
        <span className="text-2xl font-semibold tabular-nums">{total}</span>
      </div>
      <div className="flex h-16 items-end gap-px" role="img" aria-label={`${titulo}: ${total} no período`}>
        {pontos.map((p, i) => {
          const v = p[campo]
          return (
            <div
              key={`${p.rotulo}-${i}`}
              className="min-w-px flex-1 rounded-t-[2px] transition-opacity hover:opacity-70"
              style={{
                height: `${v === 0 ? 2 : Math.max(6, (v / maior) * 100)}%`,
                backgroundColor: v === 0 ? 'var(--muted)' : cor,
              }}
              title={`${p.rotulo}: ${v}`}
            />
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
        <span>{pontos[0]?.rotulo}</span>
        <span>{ultimo?.rotulo}</span>
      </div>
    </div>
  )
}

/**
 * O painel não tinha nenhuma série temporal, então não respondia "estamos
 * crescendo?". As três curvas são o caminho inteiro: entra gente, essa gente
 * busca, e essa busca vira vídeo aberto.
 */
export function Crescimento({ serie }: { serie: EngagementInsights['serie'] }) {
  const { pontos, unidade } = agrupar(serie)

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-lg">Crescimento</CardTitle>
        <CardDescription>
          Cadastros, buscas e trechos abertos por {unidade}, nos últimos {serie.length} dias.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 sm:grid-cols-3">
        <MiniGrafico titulo="Cadastros" pontos={pontos} campo="cadastros" cor="var(--primary)" />
        <MiniGrafico titulo="Buscas" pontos={pontos} campo="buscas" cor="var(--primary)" />
        <MiniGrafico titulo="Trechos abertos" pontos={pontos} campo="aberturas" cor="var(--primary)" />
      </CardContent>
    </Card>
  )
}
