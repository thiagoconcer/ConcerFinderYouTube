export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ingestion_runs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          run_type: string
          started_at: string
          status: string
          updated_at: string
          videos_processed: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          run_type: string
          started_at?: string
          status?: string
          updated_at?: string
          videos_processed?: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          run_type?: string
          started_at?: string
          status?: string
          updated_at?: string
          videos_processed?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          cargo: string | null
          commercial_role: string
          created_at: string
          email: string
          full_name: string
          id: string
          nurture_sent_at: string | null
          nurture_status: string
          profile_id: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          cargo?: string | null
          commercial_role: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          nurture_sent_at?: string | null
          nurture_status?: string
          profile_id: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          cargo?: string | null
          commercial_role?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          nurture_sent_at?: string | null
          nurture_status?: string
          profile_id?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cargo: string | null
          commercial_role: string
          created_at: string
          email: string
          full_name: string
          id: string
          role: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          cargo?: string | null
          commercial_role: string
          created_at?: string
          email: string
          full_name: string
          id: string
          role?: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          cargo?: string | null
          commercial_role?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      search_results: {
        Row: {
          created_at: string
          id: string
          rank_position: number
          search_id: string
          segment_id: string
          similarity_score: number
          start_seconds: number
          updated_at: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rank_position: number
          search_id: string
          segment_id: string
          similarity_score: number
          start_seconds: number
          updated_at?: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rank_position?: number
          search_id?: string
          segment_id?: string
          similarity_score?: number
          start_seconds?: number
          updated_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_results_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_results_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "video_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_results_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      searches: {
        Row: {
          action_plan: string | null
          created_at: string
          detected_topics: string[] | null
          id: string
          profile_id: string
          query_text: string
          updated_at: string
        }
        Insert: {
          action_plan?: string | null
          created_at?: string
          detected_topics?: string[] | null
          id?: string
          profile_id: string
          query_text: string
          updated_at?: string
        }
        Update: {
          action_plan?: string | null
          created_at?: string
          detected_topics?: string[] | null
          id?: string
          profile_id?: string
          query_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "searches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_segments: {
        Row: {
          created_at: string
          embedding: string | null
          end_seconds: number
          id: string
          segment_text: string
          start_seconds: number
          topic_tags: string[] | null
          updated_at: string
          video_id: string
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          end_seconds: number
          id?: string
          segment_text: string
          start_seconds: number
          topic_tags?: string[] | null
          updated_at?: string
          video_id: string
        }
        Update: {
          created_at?: string
          embedding?: string | null
          end_seconds?: number
          id?: string
          segment_text?: string
          start_seconds?: number
          topic_tags?: string[] | null
          updated_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_segments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_views: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          search_id: string | null
          segment_id: string | null
          start_seconds: number
          updated_at: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          search_id?: string | null
          segment_id?: string | null
          start_seconds?: number
          updated_at?: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          search_id?: string | null
          segment_id?: string | null
          start_seconds?: number
          updated_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_views_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_views_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "video_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_views_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          indexed_at: string | null
          published_at: string | null
          thumbnail_url: string | null
          title: string
          transcription_status: string
          updated_at: string
          youtube_video_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          indexed_at?: string | null
          published_at?: string | null
          thumbnail_url?: string | null
          title: string
          transcription_status?: string
          updated_at?: string
          youtube_video_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          indexed_at?: string | null
          published_at?: string | null
          thumbnail_url?: string | null
          title?: string
          transcription_status?: string
          updated_at?: string
          youtube_video_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      definir_papel: {
        Args: { p_profile_id: string; p_role: string }
        Returns: Json
      }
      get_audience_insights: {
        Args: {
          filter_commercial_role?: string
          from_date?: string
          to_date?: string
        }
        Returns: Json
      }
      get_cargo_insights: {
        Args: {
          filter_commercial_role?: string
          from_date?: string
          to_date?: string
        }
        Returns: Json
      }
      get_content_dashboard: { Args: never; Returns: Json }
      get_engagement_insights: {
        Args: {
          filter_commercial_role?: string
          from_date?: string
          to_date?: string
        }
        Returns: Json
      }
      get_equipe: { Args: never; Returns: Json }
      get_lead_detail: { Args: { p_profile_id: string }; Returns: Json }
      get_leads: {
        Args: { p_busca?: string; p_limit?: number; p_perfil?: string }
        Returns: Json
      }
      get_search_results: {
        Args: { p_search_id: string }
        Returns: {
          action_plan: string
          detected_topics: string[]
          end_seconds: number
          query_text: string
          rank_position: number
          search_id: string
          searched_at: string
          segment_id: string
          segment_text: string
          similarity_score: number
          start_seconds: number
          thumbnail_url: string
          title: string
          video_id: string
          youtube_video_id: string
        }[]
      }
      get_video_detail: { Args: { p_video_id: string }; Returns: Json }
      is_concer_admin: { Args: never; Returns: boolean }
      is_concer_staff: { Args: never; Returns: boolean }
      perfil_do_cargo: { Args: { p_cargo: string }; Returns: string }
      run_ingestion_step: { Args: { step: string }; Returns: number }
      search_videos: {
        Args: {
          detected_topics?: string[]
          match_count?: number
          min_similarity?: number
          query_embedding: string
          query_text?: string
        }
        Returns: {
          end_seconds: number
          rank_position: number
          search_id: string
          segment_id: string
          segment_text: string
          similarity_score: number
          start_seconds: number
          thumbnail_url: string
          title: string
          video_id: string
          youtube_video_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
