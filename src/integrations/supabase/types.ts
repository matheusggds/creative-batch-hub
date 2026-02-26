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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          created_at: string
          file_url: string
          id: string
          name: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          name?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          name?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      avatar_profiles: {
        Row: {
          cover_asset_id: string | null
          created_at: string
          id: string
          identity_spec: Json
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_asset_id?: string | null
          created_at?: string
          id?: string
          identity_spec?: Json
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_asset_id?: string | null
          created_at?: string
          id?: string
          identity_spec?: Json
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatar_profiles_cover_asset_id_fkey"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_reference_assets: {
        Row: {
          asset_id: string
          avatar_profile_id: string
          created_at: string
          id: string
          role: string
          sort_order: number
        }
        Insert: {
          asset_id: string
          avatar_profile_id: string
          created_at?: string
          id?: string
          role?: string
          sort_order?: number
        }
        Update: {
          asset_id?: string
          avatar_profile_id?: string
          created_at?: string
          id?: string
          role?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "avatar_reference_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_reference_assets_avatar_profile_id_fkey"
            columns: ["avatar_profile_id"]
            isOneToOne: false
            referencedRelation: "avatar_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_batches: {
        Row: {
          created_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      generation_events: {
        Row: {
          created_at: string
          generation_id: string
          id: string
          job_id: string | null
          message: string | null
          payload: Json
          type: string
        }
        Insert: {
          created_at?: string
          generation_id: string
          id?: string
          job_id?: string | null
          message?: string | null
          payload?: Json
          type: string
        }
        Update: {
          created_at?: string
          generation_id?: string
          id?: string
          job_id?: string | null
          message?: string | null
          payload?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_events_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          attempt: number
          batch_id: string | null
          created_at: string
          error_payload: Json
          generation_id: string
          id: string
          idempotency_key: string
          input_payload: Json
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          model: string | null
          next_run_at: string
          output_payload: Json
          priority: number
          provider: string | null
          status: string
          step: string
          updated_at: string
        }
        Insert: {
          attempt?: number
          batch_id?: string | null
          created_at?: string
          error_payload?: Json
          generation_id: string
          id?: string
          idempotency_key: string
          input_payload?: Json
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          model?: string | null
          next_run_at?: string
          output_payload?: Json
          priority?: number
          provider?: string | null
          status?: string
          step: string
          updated_at?: string
        }
        Update: {
          attempt?: number
          batch_id?: string | null
          created_at?: string
          error_payload?: Json
          generation_id?: string
          id?: string
          idempotency_key?: string
          input_payload?: Json
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          model?: string | null
          next_run_at?: string
          output_payload?: Json
          priority?: number
          provider?: string | null
          status?: string
          step?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "generation_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_jobs_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_reference_assets: {
        Row: {
          asset_id: string
          created_at: string
          generation_id: string
          id: string
          role: string
          sort_order: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          generation_id: string
          id?: string
          role?: string
          sort_order?: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          generation_id?: string
          id?: string
          role?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "generation_reference_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_reference_assets_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          ai_parameters: Json
          avatar_profile_id: string | null
          base_asset_id: string | null
          batch_id: string | null
          created_at: string
          current_step: string | null
          error_code: string | null
          extracted_prompt: string | null
          finished_at: string | null
          id: string
          pipeline_type: string
          progress_pct: number
          reference_asset_id: string
          result_asset_id: string | null
          result_url: string | null
          retry_count: number
          source_mode: string | null
          started_at: string | null
          status: string
          tool_type: string | null
          user_id: string
        }
        Insert: {
          ai_parameters?: Json
          avatar_profile_id?: string | null
          base_asset_id?: string | null
          batch_id?: string | null
          created_at?: string
          current_step?: string | null
          error_code?: string | null
          extracted_prompt?: string | null
          finished_at?: string | null
          id?: string
          pipeline_type?: string
          progress_pct?: number
          reference_asset_id: string
          result_asset_id?: string | null
          result_url?: string | null
          retry_count?: number
          source_mode?: string | null
          started_at?: string | null
          status?: string
          tool_type?: string | null
          user_id: string
        }
        Update: {
          ai_parameters?: Json
          avatar_profile_id?: string | null
          base_asset_id?: string | null
          batch_id?: string | null
          created_at?: string
          current_step?: string | null
          error_code?: string | null
          extracted_prompt?: string | null
          finished_at?: string | null
          id?: string
          pipeline_type?: string
          progress_pct?: number
          reference_asset_id?: string
          result_asset_id?: string | null
          result_url?: string | null
          retry_count?: number
          source_mode?: string | null
          started_at?: string | null
          status?: string
          tool_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_avatar_profile_id_fkey"
            columns: ["avatar_profile_id"]
            isOneToOne: false
            referencedRelation: "avatar_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_base_asset_id_fkey"
            columns: ["base_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "generation_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_reference_asset_id_fkey"
            columns: ["reference_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_result_asset_id_fkey"
            columns: ["result_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      variation_presets: {
        Row: {
          category: string
          constraints: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          prompt_template: string
          scope: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category: string
          constraints?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          prompt_template: string
          scope?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          constraints?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          prompt_template?: string
          scope?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
