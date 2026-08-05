import { PagePlaceholder } from '@/components/page-placeholder'
import { ROUTES } from '@/lib/routes'

export function AdminConteudoPage() {
  return (
    <PagePlaceholder
      title="Administrador de conteúdo"
      route={ROUTES.adminConteudo}
      phase="Fase 2"
      description="Painel staff-only com o status de scraping, transcrição e indexação de cada vídeo do canal."
      planned={[
        'Status geral da base (total, indexados, pendentes, falhas)',
        'Tabela de videos com transcription_status e youtube_video_id',
        'Log de ingestion_runs por tipo (scrape / transcribe / index)',
        'Botão "Rodar scraping agora" (scrape-youtube-channel)',
      ]}
      backTo={{ label: 'Voltar à busca', to: ROUTES.busca }}
    />
  )
}
