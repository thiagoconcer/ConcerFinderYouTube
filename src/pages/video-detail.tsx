import { useParams } from 'react-router-dom'
import { PagePlaceholder } from '@/components/page-placeholder'
import { ROUTES } from '@/lib/routes'

export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <PagePlaceholder
      title="Vídeo no minuto do insight"
      route={ROUTES.video(id ?? ':id')}
      phase="Fase 2"
      description="Abre o vídeo do canal já no start_seconds do trecho recomendado, com o contexto textual do insight."
      planned={[
        'Embed do YouTube iniciando no start_seconds do segmento',
        'Título, descrição, data e trecho destacado com a minutagem',
        'Outros trechos relevantes do mesmo vídeo e relacionados por tema',
        'Botões "Voltar aos resultados" e "Abrir no YouTube"',
      ]}
      backTo={{ label: 'Voltar à busca', to: ROUTES.busca }}
    />
  )
}
