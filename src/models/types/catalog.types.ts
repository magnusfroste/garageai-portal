import type { ReliabilityGrade } from "./reliability.types";
import type { GarageLocation } from "@/models/services/location";
import type { PoolSummary } from "@/models/services/poolPricing";

export interface GaragePublicStat {
  garage_name: string;
  runtime: string | null;
  online: boolean;
  tokens_7d: number;
}

export interface GarageDailyTokens {
  garage_name: string;
  day: string;
  tokens: number;
}

export interface Price {
  input: number | null;
  output: number | null;
  /** Input cache read per 1M (OpenRouter style); null when unknown. */
  cacheRead?: number | null;
}

/** One garage offering a model through its specific-garage tier. */
export interface GarageOffer {
  garage: string;
  modelId: string | null; // dedicated routing name, if the garage sells it specifically
  price: Price;
  grade: ReliabilityGrade | null;
  score: number | null;
  sampleDays: number | null;
  ttftMs: number | null;
  tokensPerSecond: number | null;
  availability30d: number | null;
  online: boolean;
  runtime: string | null;
  tokens7d: number;
  /** Display name when this garage is an endpoint provider (company), else null. */
  providerName: string | null;
  location: GarageLocation | null;
  contextLength?: number | null;
  maxOutput?: number | null;
  /** Upstream service an endpoint provider forwards to (e.g. OpenRouter); country then varies. */
  forwardsTo?: string | null;
  /** Admin-set region for providers (null = unknown); undefined for garages. */
  providerRegion?: "se" | "eu" | "other" | null;
  isProvider?: boolean;
}

/** Buyer-facing catalogue entry: one per base model name. */
export interface CatalogModel {
  requests7d?: number;
  /** Prompt + completion tokens over 30 days (public aggregate); null when unknown. */
  tokens30d?: number | null;
  /** garageai/auto: ordered failover across a curated list. */
  auto?: boolean;
  name: string;
  /** Earliest catalogue row for this model (ISO). */
  addedAt?: string | null;
  poolId: string | null;
  provider: string;
  mode: string | null;
  contextLength: number | null;
  maxOutput: number | null;
  huggingfaceUrl: string | null;
  poolPrice: Price | null;
  minPrice: Price;
  maxPrice: Price;
  offers: GarageOffer[];
  bestGrade: ReliabilityGrade | null;
  available: boolean;
  poolAvailability: number | null;
  tokens7d: number;
  tokensPerSecond: number | null;
  /** Any garage serving this model passed the tool-calling probe. */
  supportsTools: boolean;
  /** Provider-private model: own name, dedicated tier only, never pooled. */
  privateModel: boolean;
  /** Pool pricing: from / expected / cap and members with weights (null when not pooled). */
  pool?: PoolSummary | null;
}

export type CatalogSort = "popular" | "cheapest" | "fastest" | "reliable" | "newest" | "context";

export interface CatalogFilters {
  q: string;
  minContext: number | null;
  maxPrice: number | null; // max output price per 1M
  runtime: string | null;
  minGrade: ReliabilityGrade | null;
  multiGarage: boolean;
  sort: CatalogSort;
  euOnly: boolean;
}

/** Public per-model daily aggregate (market garages, buyer traffic only). */
export interface ModelDailyStat {
  model: string;
  day: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  inputSpend: number;
  outputSpend: number;
}

/** Public per-garage supply facts. */
export interface GarageSupplyFact {
  garage_name: string;
  is_endpoint: boolean;
  terms_accepted: boolean;
  forwards_to: string | null;
  tokens_1d: number;
  tokens_30d: number;
  provider_region?: "se" | "eu" | "other" | null;
}
