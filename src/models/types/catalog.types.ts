import type { ReliabilityGrade } from "./reliability.types";

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
}

/** Buyer-facing catalogue entry: one per base model name. */
export interface CatalogModel {
  name: string;
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
}

export type CatalogSort = "popular" | "cheapest" | "fastest" | "reliable";

export interface CatalogFilters {
  q: string;
  minContext: number | null;
  maxPrice: number | null; // max output price per 1M
  runtime: string | null;
  minGrade: ReliabilityGrade | null;
  multiGarage: boolean;
  sort: CatalogSort;
}
