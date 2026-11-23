// Admin-set region for endpoint providers (they cannot be measured like garages).
export const PROVIDER_REGIONS = ["se", "eu", "other"] as const;
export type ProviderRegion = typeof PROVIDER_REGIONS[number];
/** Parses a region choice; null clears it. Returns an error string when invalid. */
export const parseProviderRegion = (v: unknown): ProviderRegion | null | string =>
  v === null ? null : typeof v === "string" && (PROVIDER_REGIONS as readonly string[]).includes(v) ? v as ProviderRegion : "region must be se, eu, other or null";
