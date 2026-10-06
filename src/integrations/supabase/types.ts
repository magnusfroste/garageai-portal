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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_value: string
          litellm_token: string | null
          name: string
          revoked_at: string | null
          trial_credits_usd: number | null
          used_credits_usd: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_value: string
          litellm_token?: string | null
          name: string
          revoked_at?: string | null
          trial_credits_usd?: number | null
          used_credits_usd?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_value?: string
          litellm_token?: string | null
          name?: string
          revoked_at?: string | null
          trial_credits_usd?: number | null
          used_credits_usd?: number | null
          user_id?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          model: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          model?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          model?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount_usd: number
          created_at: string
          credits_added: number
          id: string
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          credits_added: number
          id?: string
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          credits_added?: number
          id?: string
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      curated_models: {
        Row: {
          created_at: string
          disabled_reason: string | null
          enabled: boolean
          garage: string | null
          garage_tier: string | null
          huggingface_url: string | null
          id: string
          input_cost_per_million: number | null
          is_default: boolean
          last_synced_at: string
          max_input_tokens: number | null
          max_output_tokens: number | null
          mode: string | null
          model_name: string | null
          output_cost_per_million: number | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          disabled_reason?: string | null
          enabled?: boolean
          garage?: string | null
          garage_tier?: string | null
          huggingface_url?: string | null
          id: string
          input_cost_per_million?: number | null
          is_default?: boolean
          last_synced_at?: string
          max_input_tokens?: number | null
          max_output_tokens?: number | null
          mode?: string | null
          model_name?: string | null
          output_cost_per_million?: number | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          disabled_reason?: string | null
          enabled?: boolean
          garage?: string | null
          garage_tier?: string | null
          huggingface_url?: string | null
          id?: string
          input_cost_per_million?: number | null
          is_default?: boolean
          last_synced_at?: string
          max_input_tokens?: number | null
          max_output_tokens?: number | null
          mode?: string | null
          model_name?: string | null
          output_cost_per_million?: number | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      garage_country_history: {
        Row: {
          country: string
          garage_id: string
          id: number
          seen_at: string
        }
        Insert: {
          country: string
          garage_id: string
          id?: number
          seen_at?: string
        }
        Update: {
          country?: string
          garage_id?: string
          id?: number
          seen_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_country_history_garage_id_fkey"
            columns: ["garage_id"]
            isOneToOne: false
            referencedRelation: "garages"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_model_failures: {
        Row: {
          consecutive_failures: number
          garage_id: string
          model: string
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          garage_id: string
          model: string
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          garage_id?: string
          model?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_model_failures_garage_id_fkey"
            columns: ["garage_id"]
            isOneToOne: false
            referencedRelation: "garages"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_model_stats_hourly: {
        Row: {
          completion_tokens: number
          dedicated_completion_tokens: number
          dedicated_prompt_tokens: number
          failures: number
          garage_id: string
          garage_name: string | null
          hour: string
          model: string
          prompt_tokens: number
          requests: number
          spend_usd: number
        }
        Insert: {
          completion_tokens?: number
          dedicated_completion_tokens?: number
          dedicated_prompt_tokens?: number
          failures?: number
          garage_id: string
          garage_name?: string | null
          hour: string
          model: string
          prompt_tokens?: number
          requests?: number
          spend_usd?: number
        }
        Update: {
          completion_tokens?: number
          dedicated_completion_tokens?: number
          dedicated_prompt_tokens?: number
          failures?: number
          garage_id?: string
          garage_name?: string | null
          hour?: string
          model?: string
          prompt_tokens?: number
          requests?: number
          spend_usd?: number
        }
        Relationships: []
      }
      garage_model_tests: {
        Row: {
          duration_ms: number | null
          error: string | null
          garage_id: string
          http_status: number | null
          id: string
          inconclusive: boolean
          instruction_followed: boolean | null
          model: string
          output_tokens: number | null
          passed: boolean
          supports_tools: boolean | null
          tested_at: string
          tokens_per_second: number | null
          tools_error: string | null
          ttft_ms: number | null
        }
        Insert: {
          duration_ms?: number | null
          error?: string | null
          garage_id: string
          http_status?: number | null
          id?: string
          inconclusive?: boolean
          instruction_followed?: boolean | null
          model: string
          output_tokens?: number | null
          passed: boolean
          supports_tools?: boolean | null
          tested_at?: string
          tokens_per_second?: number | null
          tools_error?: string | null
          ttft_ms?: number | null
        }
        Update: {
          duration_ms?: number | null
          error?: string | null
          garage_id?: string
          http_status?: number | null
          id?: string
          inconclusive?: boolean
          instruction_followed?: boolean | null
          model?: string
          output_tokens?: number | null
          passed?: boolean
          supports_tools?: boolean | null
          tested_at?: string
          tokens_per_second?: number | null
          tools_error?: string | null
          ttft_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_model_tests_garage_id_fkey"
            columns: ["garage_id"]
            isOneToOne: false
            referencedRelation: "garages"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_models: {
        Row: {
          canonical_model: string
          canonical_source: string
          garage_id: string
          installed: boolean
          model: string
          offered: boolean
          paused_at: string | null
          private: boolean
          status: string
          updated_at: string
        }
        Insert: {
          canonical_model?: string
          canonical_source?: string
          garage_id: string
          installed?: boolean
          model: string
          offered?: boolean
          paused_at?: string | null
          private?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          canonical_model?: string
          canonical_source?: string
          garage_id?: string
          installed?: boolean
          model?: string
          offered?: boolean
          paused_at?: string | null
          private?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_models_garage_id_fkey"
            columns: ["garage_id"]
            isOneToOne: false
            referencedRelation: "garages"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_price_history: {
        Row: {
          changed_by: string | null
          effective_from: string
          garage_id: string
          garage_name: string | null
          id: string
          prices: Json
        }
        Insert: {
          changed_by?: string | null
          effective_from?: string
          garage_id: string
          garage_name?: string | null
          id?: string
          prices: Json
        }
        Update: {
          changed_by?: string | null
          effective_from?: string
          garage_id?: string
          garage_name?: string | null
          id?: string
          prices?: Json
        }
        Relationships: []
      }
      garage_request_stats_hourly: {
        Row: {
          completion_tokens: number
          failures: number
          garage_id: string
          garage_name: string | null
          hour: string
          prompt_tokens: number
          requests: number
          spend_usd: number
          tokens_per_second_p50: number | null
          ttft_ms_p50: number | null
        }
        Insert: {
          completion_tokens?: number
          failures?: number
          garage_id: string
          garage_name?: string | null
          hour: string
          prompt_tokens?: number
          requests?: number
          spend_usd?: number
          tokens_per_second_p50?: number | null
          ttft_ms_p50?: number | null
        }
        Update: {
          completion_tokens?: number
          failures?: number
          garage_id?: string
          garage_name?: string | null
          hour?: string
          prompt_tokens?: number
          requests?: number
          spend_usd?: number
          tokens_per_second_p50?: number | null
          ttft_ms_p50?: number | null
        }
        Relationships: []
      }
      garage_runtime_secrets: {
        Row: {
          garage_id: string
          runtime_api_key: string | null
          updated_at: string
        }
        Insert: {
          garage_id: string
          runtime_api_key?: string | null
          updated_at?: string
        }
        Update: {
          garage_id?: string
          runtime_api_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_runtime_secrets_garage_id_fkey"
            columns: ["garage_id"]
            isOneToOne: true
            referencedRelation: "garages"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_status_samples: {
        Row: {
          garage_id: string
          id: number
          online: boolean
          reason: string | null
          sampled_at: string
        }
        Insert: {
          garage_id: string
          id?: never
          online: boolean
          reason?: string | null
          sampled_at?: string
        }
        Update: {
          garage_id?: string
          id?: never
          online?: boolean
          reason?: string | null
          sampled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_status_samples_garage_id_fkey"
            columns: ["garage_id"]
            isOneToOne: false
            referencedRelation: "garages"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_tokens: {
        Row: {
          created_at: string | null
          garage_id: string
          id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string | null
          garage_id: string
          id?: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string | null
          garage_id?: string
          id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_tokens_garage_id_fkey"
            columns: ["garage_id"]
            isOneToOne: false
            referencedRelation: "garages"
            referencedColumns: ["id"]
          },
        ]
      }
      garages: {
        Row: {
          api_host: string | null
          connection_type: string
          country_override: string | null
          created_at: string
          declared_country: string | null
          dedicated_input_cost_per_million: number
          dedicated_output_cost_per_million: number
          disabled: boolean
          display_name: string | null
          endpoint_url: string | null
          id: string
          last_gateway_check_at: string | null
          last_heartbeat_at: string | null
          last_registered_at: string | null
          location_display: string
          measured_country: string | null
          measured_country_at: string | null
          mesh_connected: boolean | null
          mesh_ip: string | null
          models: string[]
          name: string
          netbird_peer_id: string | null
          operator_id: string | null
          paused_at: string | null
          paused_reason: string | null
          pool_input_cost_per_million: number
          pool_output_cost_per_million: number
          port: number | null
          runtime: string | null
          runtime_error: string | null
          runtime_models: string[]
          runtime_ok: boolean | null
          status: string
          updated_at: string
        }
        Insert: {
          api_host?: string | null
          connection_type?: string
          country_override?: string | null
          created_at?: string
          declared_country?: string | null
          dedicated_input_cost_per_million?: number
          dedicated_output_cost_per_million?: number
          disabled?: boolean
          display_name?: string | null
          endpoint_url?: string | null
          id?: string
          last_gateway_check_at?: string | null
          last_heartbeat_at?: string | null
          last_registered_at?: string | null
          location_display?: string
          measured_country?: string | null
          measured_country_at?: string | null
          mesh_connected?: boolean | null
          mesh_ip?: string | null
          models?: string[]
          name: string
          netbird_peer_id?: string | null
          operator_id?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          pool_input_cost_per_million?: number
          pool_output_cost_per_million?: number
          port?: number | null
          runtime?: string | null
          runtime_error?: string | null
          runtime_models?: string[]
          runtime_ok?: boolean | null
          status?: string
          updated_at?: string
        }
        Update: {
          api_host?: string | null
          connection_type?: string
          country_override?: string | null
          created_at?: string
          declared_country?: string | null
          dedicated_input_cost_per_million?: number
          dedicated_output_cost_per_million?: number
          disabled?: boolean
          display_name?: string | null
          endpoint_url?: string | null
          id?: string
          last_gateway_check_at?: string | null
          last_heartbeat_at?: string | null
          last_registered_at?: string | null
          location_display?: string
          measured_country?: string | null
          measured_country_at?: string | null
          mesh_connected?: boolean | null
          mesh_ip?: string | null
          models?: string[]
          name?: string
          netbird_peer_id?: string | null
          operator_id?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          pool_input_cost_per_million?: number
          pool_output_cost_per_million?: number
          port?: number | null
          runtime?: string | null
          runtime_error?: string | null
          runtime_models?: string[]
          runtime_ok?: boolean | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ingest_cursors: {
        Row: {
          name: string
          updated_at: string
          value: string
        }
        Insert: {
          name: string
          updated_at?: string
          value: string
        }
        Update: {
          name?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      internal_secrets: {
        Row: {
          created_at: string
          name: string
          value: string
        }
        Insert: {
          created_at?: string
          name: string
          value: string
        }
        Update: {
          created_at?: string
          name?: string
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          litellm_user_id: string | null
          onboarding_done: boolean
          preferred_language: string
          purchased_credits_usd: number
          signup_intent: string | null
          starting_credit_usd: number
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          litellm_user_id?: string | null
          onboarding_done?: boolean
          preferred_language?: string
          purchased_credits_usd?: number
          signup_intent?: string | null
          starting_credit_usd?: number
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          litellm_user_id?: string | null
          onboarding_done?: boolean
          preferred_language?: string
          purchased_credits_usd?: number
          signup_intent?: string | null
          starting_credit_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      token_usage: {
        Row: {
          api_key_id: string
          cost_usd: number
          id: string
          model: string | null
          timestamp: string
          tokens_used: number
          user_id: string
        }
        Insert: {
          api_key_id: string
          cost_usd: number
          id?: string
          model?: string | null
          timestamp?: string
          tokens_used: number
          user_id: string
        }
        Update: {
          api_key_id?: string
          cost_usd?: number
          id?: string
          model?: string | null
          timestamp?: string
          tokens_used?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_checkout_credits: {
        Args: { p_credits: number; p_session_id: string; p_user_id: string }
        Returns: {
          already_processed: boolean
          credits_added: number
          total_budget: number
        }[]
      }
      garage_daily_tokens: {
        Args: { _names: string[] }
        Returns: {
          day: string
          garage_name: string
          tokens: number
        }[]
      }
      garage_offline_periods: {
        Args: { _limit?: number; _name: string }
        Returns: {
          duration_seconds: number
          ended_at: string
          reason: string
          started_at: string
        }[]
      }
      garage_profile: { Args: { _name: string }; Returns: Json }
      garage_public_locations: {
        Args: never
        Returns: {
          country: string
          garage_name: string
          is_endpoint: boolean
          is_new: boolean
          live_hours_per_week: number
          live_hours_total: number
          location_display: string
          location_source: string
        }[]
      }
      garage_public_models: {
        Args: never
        Returns: {
          garage_name: string
          model: string
          private: boolean
        }[]
      }
      garage_public_providers: {
        Args: never
        Returns: {
          display_name: string
          garage_name: string
        }[]
      }
      garage_public_stats: {
        Args: never
        Returns: {
          garage_name: string
          online: boolean
          runtime: string
          tokens_7d: number
        }[]
      }
      garage_reliability: {
        Args: { _names?: string[] }
        Returns: {
          availability: number
          garage_name: string
          grade: string
          period: string
          requests: number
          sample_days: number
          score: number
          success_rate: number
          tokens_per_second: number
          ttft_ms_p50: number
        }[]
      }
      garage_revenue: {
        Args: { _from: string; _to: string }
        Returns: {
          completion_tokens: number
          connection_type: string
          display_name: string
          failures: number
          garage_name: string
          model: string
          prompt_tokens: number
          requests: number
          spend_usd: number
        }[]
      }
      garage_tool_support: {
        Args: never
        Returns: {
          garage_name: string
          model: string
          supports_tools: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalise_model_id: { Args: { _id: string }; Returns: string }
      operator_garage_activity: {
        Args: never
        Returns: {
          completion_tokens: number
          estimated_earnings: number
          garage_id: string
          period: string
          prompt_tokens: number
          recorded_spend: number
          requests: number
        }[]
      }
      set_garage_location_display: {
        Args: { _garage_id: string; _mode: string }
        Returns: undefined
      }
      verify_cron_secret: { Args: { secret: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
