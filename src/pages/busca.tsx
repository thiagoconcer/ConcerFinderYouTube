import { PagePlaceholder } from '@/components/page-placeholder'
import { ROUTES } from '@/lib/routes'

export function BuscaPage() {
  return (
    <PagePlaceholder
      title="Busca por dor de vendas"
      route={ROUTES.busca}
      phase="Fase 2"
      description="Aqui o usuário descreve a dor em linguagem natural e recebe os trechos certos, com minutagem exata e plano de ação."
      planned={[
        'Caixa de busca em linguagem natural com sugestões de dores comuns',
        'RPC search_videos (pgvector) + Edge Function generate-action-plan',
        'Plano de ação no topo e cards de vídeo com "Ver no minuto X"',
        'Estados de vazio, sem resultados relevantes, carregando e erro',
      ]}
      backTo={{ label: 'Ver histórico de buscas', to: ROUTES.historico }}
    />
  )
}
