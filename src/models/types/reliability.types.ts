export type ReliabilityPeriod = "24h" | "7d" | "30d";
export type ReliabilityGrade = "A" | "B" | "C" | "D" | "Nytt";

export interface ReliabilityWindow {
  garage_name: string;
  period: ReliabilityPeriod;
  availability: number | null;
  success_rate: number | null;
  requests: number;
  ttft_ms_p50: number | null;
  tokens_per_second: number | null;
  score: number | null;
  grade: ReliabilityGrade;
  sample_days: number;
}

export interface GarageReliability {
  garage_name: string;
  grade: ReliabilityGrade;
  score: number | null;
  windows: Partial<Record<ReliabilityPeriod, ReliabilityWindow>>;
}

export interface GarageDay {
  day: string;
  online_pct: number | null;
  samples: number;
}

export interface GarageProfile {
  name: string;
  runtime: string | null;
  models: string[];
  status: string;
  disabled: boolean;
  active_since: string;
  total_tokens: number;
  daily: GarageDay[];
}

export type OfflineReason = "no_heartbeat" | "mesh_disconnected" | "no_models" | null;

export interface OfflinePeriod {
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  reason: OfflineReason;
}
