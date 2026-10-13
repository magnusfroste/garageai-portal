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
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          level: string
          link_text: string | null
          link_url: string | null
          starts_at: string
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          level?: string
          link_text?: string | null
          link_url?: string | null
          starts_at?: string
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          level?: string
          link_text?: string | null
          link_url?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      auto_route: {
        Row: {
          created_at: string
          curated_model_id: string
          enabled: boolean
          id: string
          note: string | null
          position: number
        }
        Insert: {
          created_at?: string
          curated_model_id: string
          enabled?: boolean
          id?: string
          note?: string | null
          position: number
        }
        Update: {
          created_at?: string
          curated_model_id?: string
          enabled?: boolean
          id?: string
          note?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "auto_route_curated_model_id_fkey"
            columns: ["curated_model_id"]
            isOneToOne: true
            referencedRelation: "curated_models"
            referencedColumns: ["id"]
          },
        ]
      }
      bridge_links: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          arch: string | null
          bridge_version: string | null
          created_at: string
          credentials: Json | null
          device_code_hash: string
          entry: string | null
          expires_at: string
          garage_id: string | null
          gpu: string | null
          hostname: string | null
          id: string
          last_poll_at: string | null
          machine_id: string | null
          memory_gb: number | null
          models: Json
          os: string | null
          picked_up_at: string | null
          requested_ip_country: string | null
          requested_ip_hash: string | null
          runtime: string | null
          status: string
          suggested_name: string | null
          transport: string
          user_code: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          arch?: string | null
          bridge_version?: string | null
          created_at?: string
          credentials?: Json | null
          device_code_hash: string
          entry?: string | null
          expires_at?: string
          garage_id?: string | null
          gpu?: string | null
          hostname?: string | null
          id?: string
          last_poll_at?: string | null
          machine_id?: string | null
          memory_gb?: number | null
          models?: Json
          os?: string | null
          picked_up_at?: string | null
          requested_ip_country?: string | null
          requested_ip_hash?: string | null
          runtime?: string | null
          status?: string
          suggested_name?: string | null
          transport?: string
          user_code: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          arch?: string | null
          bridge_version?: string | null
          created_at?: string
          credentials?: Json | null
          device_code_hash?: string
          entry?: string | null
          expires_at?: string
          garage_id?: string | null
          gpu?: string | null
          hostname?: string | null
          id?: string
          last_poll_at?: string | null
          machine_id?: string | null
          memory_gb?: number | null
          models?: Json
          os?: string | null
          picked_up_at?: string | null
          requested_ip_country?: string | null
          requested_ip_hash?: string | null
          runtime?: string | null
          status?: string
          suggested_name?: string | null
          transport?: string
          user_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "bridge_links_garage_id_fkey"
            columns: ["garage_id"]
            isOneToOne: false
            referencedRelation: "garages"
            referencedColumns: ["id"]
          },
        ]
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
          cache_read_cost_per_million: number | null
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
          ollama_tag: string | null
          output_cost_per_million: number | null
          provider: string
          status: string
          supports_tools: boolean | null
          updated_at: string
        }
        Insert: {
          cache_read_cost_per_million?: number | null
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
          ollama_tag?: string | null
          output_cost_per_million?: number | null
          provider?: string
          status?: string
          supports_tools?: boolean | null
          updated_at?: string
        }
        Update: {
          cache_read_cost_per_million?: number | null
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
          ollama_tag?: string | null
          output_cost_per_million?: number | null
          provider?: string
          status?: string
          supports_tools?: boolean | null
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
      garage_managed_models: {
        Row: {
          action: string
          by: string
          completed_mb: number | null
          error: string | null
          garage_id: string
          model: string
          reported_at: string | null
          requested_at: string
          status: string
          total_mb: number | null
        }
        Insert: {
          action: string
          by: string
          completed_mb?: number | null
          error?: string | null
          garage_id: string
          model: string
          reported_at?: string | null
          requested_at?: string
          status?: string
          total_mb?: number | null
        }
        Update: {
          action?: string
          by?: string
          completed_mb?: number | null
          error?: string | null
          garage_id?: string
          model?: string
          reported_at?: string | null
          requested_at?: string
          status?: string
          total_mb?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_managed_models_garage_id_fkey"
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
          cached_prompt_tokens: number
          cached_spend_usd: number
          completion_tokens: number
          dedicated_completion_tokens: number
          dedicated_prompt_tokens: number
          failures: number
          garage_id: string
          garage_name: string | null
          hour: string
          input_spend_usd: number
          model: string
          output_spend_usd: number
          prompt_tokens: number
          requests: number
          spend_usd: number
        }
        Insert: {
          cached_prompt_tokens?: number
          cached_spend_usd?: number
          completion_tokens?: number
          dedicated_completion_tokens?: number
          dedicated_prompt_tokens?: number
          failures?: number
          garage_id: string
          garage_name?: string | null
          hour: string
          input_spend_usd?: number
          model: string
          output_spend_usd?: number
          prompt_tokens?: number
          requests?: number
          spend_usd?: number
        }
        Update: {
          cached_prompt_tokens?: number
          cached_spend_usd?: number
          completion_tokens?: number
          dedicated_completion_tokens?: number
          dedicated_prompt_tokens?: number
          failures?: number
          garage_id?: string
          garage_name?: string | null
          hour?: string
          input_spend_usd?: number
          model?: string
          output_spend_usd?: number
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
          context_length: number | null
          dedicated_cache_read_cost_per_million: number | null
          garage_id: string
          installed: boolean
          missing_heartbeats: number
          model: string
          offered: boolean
          paused_at: string | null
          pool_cache_read_cost_per_million: number | null
          private: boolean
          status: string
          updated_at: string
        }
        Insert: {
          canonical_model?: string
          canonical_source?: string
          context_length?: number | null
          dedicated_cache_read_cost_per_million?: number | null
          garage_id: string
          installed?: boolean
          missing_heartbeats?: number
          model: string
          offered?: boolean
          paused_at?: string | null
          pool_cache_read_cost_per_million?: number | null
          private?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          canonical_model?: string
          canonical_source?: string
          context_length?: number | null
          dedicated_cache_read_cost_per_million?: number | null
          garage_id?: string
          installed?: boolean
          missing_heartbeats?: number
          model?: string
          offered?: boolean
          paused_at?: string | null
          pool_cache_read_cost_per_million?: number | null
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
          relink: boolean
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string | null
          garage_id: string
          id?: string
          relink?: boolean
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string | null
          garage_id?: string
          id?: string
          relink?: boolean
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
          agent: Json | null
          agent_at: string | null
          api_host: string | null
          connection_type: string
          country_override: string | null
          created_at: string
          declared_country: string | null
          dedicated_cache_read_cost_per_million: number | null
          dedicated_input_cost_per_million: number
          dedicated_output_cost_per_million: number
          disabled: boolean
          display_name: string | null
          endpoint_url: string | null
          first_models_at: string | null
          id: string
          last_gateway_check_at: string | null
          last_heartbeat_at: string | null
          last_machine_id: string | null
          last_registered_at: string | null
          location_display: string
          machine_hostname: string | null
          machine_id: string | null
          measured_country: string | null
          measured_country_at: string | null
          mesh_connected: boolean | null
          mesh_ip: string | null
          models: string[]
          name: string
          netbird_peer_id: string | null
          offer_page_seen_at: string | null
          operator_id: string | null
          paused_at: string | null
          paused_by_admin: boolean
          paused_reason: string | null
          pool_cache_read_cost_per_million: number | null
          pool_input_cost_per_million: number
          pool_output_cost_per_million: number
          port: number | null
          runtime: string | null
          runtime_error: string | null
          runtime_models: string[]
          runtime_ok: boolean | null
          status: string
          terms_accepted_at: string | null
          terms_version: string | null
          transport: string
          tunnel_assigned_at: string | null
          tunnel_ip: string | null
          tunnel_public_key: string | null
          updated_at: string
        }
        Insert: {
          agent?: Json | null
          agent_at?: string | null
          api_host?: string | null
          connection_type?: string
          country_override?: string | null
          created_at?: string
          declared_country?: string | null
          dedicated_cache_read_cost_per_million?: number | null
          dedicated_input_cost_per_million?: number
          dedicated_output_cost_per_million?: number
          disabled?: boolean
          display_name?: string | null
          endpoint_url?: string | null
          first_models_at?: string | null
          id?: string
          last_gateway_check_at?: string | null
          last_heartbeat_at?: string | null
          last_machine_id?: string | null
          last_registered_at?: string | null
          location_display?: string
          machine_hostname?: string | null
          machine_id?: string | null
          measured_country?: string | null
          measured_country_at?: string | null
          mesh_connected?: boolean | null
          mesh_ip?: string | null
          models?: string[]
          name: string
          netbird_peer_id?: string | null
          offer_page_seen_at?: string | null
          operator_id?: string | null
          paused_at?: string | null
          paused_by_admin?: boolean
          paused_reason?: string | null
          pool_cache_read_cost_per_million?: number | null
          pool_input_cost_per_million?: number
          pool_output_cost_per_million?: number
          port?: number | null
          runtime?: string | null
          runtime_error?: string | null
          runtime_models?: string[]
          runtime_ok?: boolean | null
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          transport?: string
          tunnel_assigned_at?: string | null
          tunnel_ip?: string | null
          tunnel_public_key?: string | null
          updated_at?: string
        }
        Update: {
          agent?: Json | null
          agent_at?: string | null
          api_host?: string | null
          connection_type?: string
          country_override?: string | null
          created_at?: string
          declared_country?: string | null
          dedicated_cache_read_cost_per_million?: number | null
          dedicated_input_cost_per_million?: number
          dedicated_output_cost_per_million?: number
          disabled?: boolean
          display_name?: string | null
          endpoint_url?: string | null
          first_models_at?: string | null
          id?: string
          last_gateway_check_at?: string | null
          last_heartbeat_at?: string | null
          last_machine_id?: string | null
          last_registered_at?: string | null
          location_display?: string
          machine_hostname?: string | null
          machine_id?: string | null
          measured_country?: string | null
          measured_country_at?: string | null
          mesh_connected?: boolean | null
          mesh_ip?: string | null
          models?: string[]
          name?: string
          netbird_peer_id?: string | null
          offer_page_seen_at?: string | null
          operator_id?: string | null
          paused_at?: string | null
          paused_by_admin?: boolean
          paused_reason?: string | null
          pool_cache_read_cost_per_million?: number | null
          pool_input_cost_per_million?: number
          pool_output_cost_per_million?: number
          port?: number | null
          runtime?: string | null
          runtime_error?: string | null
          runtime_models?: string[]
          runtime_ok?: boolean | null
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          transport?: string
          tunnel_assigned_at?: string | null
          tunnel_ip?: string | null
          tunnel_public_key?: string | null
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
      market_prices: {
        Row: {
          fetched_at: string
          input_per_m: number
          model_id: string
          output_per_m: number
        }
        Insert: {
          fetched_at?: string
          input_per_m: number
          model_id: string
          output_per_m: number
        }
        Update: {
          fetched_at?: string
          input_per_m?: number
          model_id?: string
          output_per_m?: number
        }
        Relationships: []
      }
      onboarding_events: {
        Row: {
          arch: string | null
          created_at: string
          garage_id: string
          gpu: string | null
          id: string
          machine_id: string | null
          memory_gb: string | null
          message: string | null
          node_name: string | null
          os: string | null
          port: string | null
          profile: Json | null
          runtime: string | null
          script_version: string | null
          status: string
          step: string
        }
        Insert: {
          arch?: string | null
          created_at?: string
          garage_id: string
          gpu?: string | null
          id?: string
          machine_id?: string | null
          memory_gb?: string | null
          message?: string | null
          node_name?: string | null
          os?: string | null
          port?: string | null
          profile?: Json | null
          runtime?: string | null
          script_version?: string | null
          status: string
          step: string
        }
        Update: {
          arch?: string | null
          created_at?: string
          garage_id?: string
          gpu?: string | null
          id?: string
          machine_id?: string | null
          memory_gb?: string | null
          message?: string | null
          node_name?: string | null
          os?: string | null
          port?: string | null
          profile?: Json | null
          runtime?: string | null
          script_version?: string | null
          status?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_events_garage_id_fkey"
            columns: ["garage_id"]
            isOneToOne: false
            referencedRelation: "garages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company: string | null
          connect_page_seen_at: string | null
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
          connect_page_seen_at?: string | null
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
          connect_page_seen_at?: string | null
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
      cancel_managed_model: {
        Args: { _garage_id: string; _model: string }
        Returns: undefined
      }
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
          cached_prompt_tokens: number
          cached_spend_usd: number
          completion_tokens: number
          connection_type: string
          display_name: string
          failures: number
          garage_name: string
          input_spend_usd: number
          model: string
          output_spend_usd: number
          prompt_tokens: number
          requests: number
          runtime_models: string[]
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
      mark_connect_page_seen: { Args: never; Returns: undefined }
      mark_offer_page_seen: { Args: { _garage_id: string }; Returns: undefined }
      model_demand: {
        Args: never
        Returns: {
          model: string
          requests_7d: number
        }[]
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
      record_bridge_release:
        | {
            Args: { p_checked_at: string; p_tag: string; p_version: string }
            Returns: undefined
          }
        | {
            Args: {
              p_checked_at: string
              p_published_at: string
              p_tag: string
              p_version: string
            }
            Returns: undefined
          }
      request_managed_model: {
        Args: { _action: string; _garage_id: string; _model: string }
        Returns: undefined
      }
      set_bridge_pin: { Args: { p_pinned: string }; Returns: undefined }
      set_bridge_update: {
        Args: {
          p_auto_after_hours?: number
          p_mode?: string
          p_stable?: string
        }
        Returns: Json
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
