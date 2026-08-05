import { PagePlaceholder } from '@/components/page-placeholder'
import { ROUTES } from '@/lib/routes'

export function AdminAudienciaPage() {
  return (
    <PagePlaceholder
      title="Gestor de audiência"
      route={ROUTES.adminAudiencia}
      phase="Fase 2"
      description="Painel staff-only com leads, perfis comerciais e os temas de dor mais buscados pela audiência."
      planned={[
        'Indicadores de leads e distribuição por perfil comercial',
        'Ranking de temas mais buscados via get_audience_insights()',
        'Tabela de leads com nurture_status (pending / sent / failed)',
        'Filtros por perfil e por tema para segmentação comercial',
      ]}
      backTo={{ label: 'Voltar à busca', to: ROUTES.busca }}
    />
  )
}
