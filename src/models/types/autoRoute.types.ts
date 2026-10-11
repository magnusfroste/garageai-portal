export interface AutoRouteEntry {
  id: string;
  position: number;
  curated_model_id: string;
  enabled: boolean;
  note: string | null;
  created_at: string;
}

export interface AutoSettings {
  public_name: string;
  input_cost_per_million: number | null;
  output_cost_per_million: number | null;
  cache_read_cost_per_million: number | null;
  enabled: boolean;
}

export type AutoWarning = "no_tools" | "small_context" | "low_grade";

export interface AutoEntryView {
  entry: AutoRouteEntry;
  label: string;
  garage: string | null;
  tier: string | null;
  runtimeModel: string;
  status: string;
  grade: string | null;
  supportsTools: boolean;
  context: number | null;
  price: { input: number | null; output: number | null; cacheRead: number | null };
  missing: boolean;
  warnings: AutoWarning[];
}
