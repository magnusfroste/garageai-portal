export interface CuratedModel {
  id: string;
  model_name: string | null;
  /** Why the model is off: 'admin' (manual) or 'failed_test' (automatic). */
  disabled_reason?: "admin" | "failed_test" | "paused" | null;
  provider: string;
  max_input_tokens: number | null;
  max_output_tokens: number | null;
  input_cost_per_million: number | null;
  output_cost_per_million: number | null;
  mode: string | null;
  status: "healthy" | "unhealthy" | "unknown";
  enabled: boolean;
  is_default: boolean;
  garage: string | null;
  garage_tier: string | null;
  huggingface_url: string | null;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}
