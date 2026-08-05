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
export type AppRole = 'user' | 'content_admin' | 'audience_manager' | 'admin'
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

/**
 * Cargo declarado no cadastro. São os mesmos 9 do campo "Cargo Newsletter"
 * do ActiveCampaign, na mesma ordem hierárquica, para o lead do ConcerFinder
 * ficar comparável com o resto da base da Concer.
 */
export type Cargo =
  | 'fundador'
  | 'socio'
  | 'presidente_ceo'
  | 'vice_presidente'
  | 'diretor'
  | 'coordenador'
  | 'supervisor'
  | 'gerente'
  | 'vendedor'

/** Os rótulos são idênticos aos do ActiveCampaign, inclusive o "(a)". */
export const CARGO_LABELS: Record<Cargo, string> = {
  fundador: 'Fundador (a)',
  socio: 'Sócio (a)',
  presidente_ceo: 'Presidente ou CEO',
  vice_presidente: 'Vice-presidente',
  diretor: 'Diretor (a)',
  coordenador: 'Coordenador (a)',
  supervisor: 'Supervisor (a)',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
}

/**
 * Só para a UI antecipar o que vai acontecer. Quem decide de verdade é o
 * banco, na função `public.perfil_do_cargo`, e o trigger reescreve o perfil
 * mesmo que o cliente mande outra coisa. Se um dia divergirem, o banco vence.
 */
export const CARGO_PARA_PERFIL: Record<Cargo, CommercialRole> = {
  fundador: 'dono_empresa',
  socio: 'dono_empresa',
  presidente_ceo: 'dono_empresa',
  vice_presidente: 'dono_empresa',
  diretor: 'gestor_comercial',
  coordenador: 'gestor_comercial',
  supervisor: 'gestor_comercial',
  gerente: 'gestor_comercial',
  vendedor: 'vendedor',
}
