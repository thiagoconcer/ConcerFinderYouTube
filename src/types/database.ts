/**
 * Tipos do banco do ConcerFinder.
 * Fonte única do modelo de dados: db/schemas.sql (não invente coluna fora dele).
 */

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

export interface Profile {
  id: string
  full_name: string
  email: string
  whatsapp: string
  commercial_role: CommercialRole
  role: AppRole
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  profile_id: string
  full_name: string
  email: string
  whatsapp: string
  commercial_role: string
  nurture_status: NurtureStatus
  nurture_sent_at: string | null
  created_at: string
  updated_at: string
}

export interface Video {
  id: string
  youtube_video_id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  published_at: string | null
  transcription_status: TranscriptionStatus
  indexed_at: string | null
  created_at: string
  updated_at: string
}

export interface VideoSegment {
  id: string
  video_id: string
  segment_text: string
  start_seconds: number
  end_seconds: number
  topic_tags: string[] | null
  embedding: number[] | null
  created_at: string
  updated_at: string
}

export interface Search {
  id: string
  profile_id: string
  query_text: string
  detected_topics: string[] | null
  action_plan: string | null
  created_at: string
  updated_at: string
}

export interface SearchResult {
  id: string
  search_id: string
  video_id: string
  segment_id: string
  start_seconds: number
  similarity_score: number
  rank_position: number
  created_at: string
  updated_at: string
}

export interface IngestionRun {
  id: string
  run_type: IngestionRunType
  status: IngestionStatus
  videos_processed: number
  error_message: string | null
  started_at: string
  finished_at: string | null
  created_at: string
  updated_at: string
}

type Insert<T, Optional extends keyof T> = Omit<T, Optional> &
  Partial<Pick<T, Optional>>

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Insert<Profile, 'role' | 'created_at' | 'updated_at'>
        Update: Partial<Profile>
      }
      leads: {
        Row: Lead
        Insert: Insert<
          Lead,
          'id' | 'nurture_status' | 'nurture_sent_at' | 'created_at' | 'updated_at'
        >
        Update: Partial<Lead>
      }
      videos: {
        Row: Video
        Insert: Insert<
          Video,
          'id' | 'transcription_status' | 'indexed_at' | 'created_at' | 'updated_at'
        >
        Update: Partial<Video>
      }
      video_segments: {
        Row: VideoSegment
        Insert: Insert<VideoSegment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<VideoSegment>
      }
      searches: {
        Row: Search
        Insert: Insert<Search, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Search>
      }
      search_results: {
        Row: SearchResult
        Insert: Insert<SearchResult, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<SearchResult>
      }
      ingestion_runs: {
        Row: IngestionRun
        Insert: Insert<
          IngestionRun,
          'id' | 'status' | 'videos_processed' | 'started_at' | 'created_at' | 'updated_at'
        >
        Update: Partial<IngestionRun>
      }
    }
    Views: Record<string, never>
    Functions: {
      is_concer_staff: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

/** Rótulos em pt-BR do perfil comercial (UI em português, dados em inglês). */
export const COMMERCIAL_ROLE_LABELS: Record<CommercialRole, string> = {
  vendedor: 'Vendedor',
  gestor_comercial: 'Gestor comercial',
  dono_empresa: 'Dono de empresa',
}
