/**
 * Tipos do banco do ConcerFinder.
 *
 * O `Database` vem de `src/types/supabase.ts`, gerado do banco real com
 * `supabase gen types typescript --project-id lzjwiibsqbowrrekptvg`.
 * Regenere sempre que rodar uma migration nova.
 *
 * Aqui ficam só os apelidos de domínio e os rótulos de UI.
 * Fonte única do modelo de dados continua sendo db/schemas.sql.
 */
import type { Database, Tables } from './supabase'

export type { Database }

export type Profile = Tables<'profiles'>
export type Lead = Tables<'leads'>
export type Video = Tables<'videos'>
export type VideoSegment = Tables<'video_segments'>
export type Search = Tables<'searches'>
export type SearchResult = Tables<'search_results'>
export type IngestionRun = Tables<'ingestion_runs'>

// Os CHECKs do schema não viram enum no Postgres, então os domínios ficam
// declarados aqui para a UI ter exaustividade.
export type CommercialRole = 'vendedor' | 'gestor_comercial' | 'dono_empresa'
export type AppRole = 'user' | 'content_admin' | 'audience_manager'
export type NurtureStatus = 'pending' | 'sent' | 'failed'
export type TranscriptionStatus =
  | 'pending'
  | 'transcribing'
  | 'transcribed'
  | 'indexed'
  | 'failed'
export type IngestionRunType = 'scrape' | 'transcribe' | 'index'
export type IngestionStatus = 'running' | 'completed' | 'failed'

/** Rótulos em pt-BR do perfil comercial (UI em português, dados em inglês). */
export const COMMERCIAL_ROLE_LABELS: Record<CommercialRole, string> = {
  vendedor: 'Vendedor',
  gestor_comercial: 'Gestor comercial',
  dono_empresa: 'Dono de empresa',
}
