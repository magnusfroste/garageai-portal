export interface ModelUsage {
  model: string;
  cost: number;
  tokens: number;
  /** Prompt tokens served from cache; included in `tokens`. */
  cachedTokens?: number;
  requests: number;
}
