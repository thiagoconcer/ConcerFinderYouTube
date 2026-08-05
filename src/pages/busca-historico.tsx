import { PagePlaceholder } from '@/components/page-placeholder'
import { ROUTES } from '@/lib/routes'

export function BuscaHistoricoPage() {
  return (
    <PagePlaceholder
      title="Histórico de buscas"
      route={ROUTES.historico}
      phase="Fase 2"
      description="Histórico das buscas do próprio usuário, com os temas detectados e atalho para repetir a busca."
      planned={[
        'Lista das buscas anteriores (query, data e temas detectados)',
        'Chips de temas recorrentes para refazer a busca em um clique',
        'Ações "Repetir busca" e "Ver resultados"',
        'RLS: cada usuário enxerga apenas profile_id = auth.uid()',
      ]}
      backTo={{ label: 'Ir para a busca', to: ROUTES.busca }}
    />
  )
}
