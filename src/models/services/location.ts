import { currentLanguage } from "@/i18n";

/** EU27 + EEA (IS, LI, NO). */
export const EU_EEA = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
  "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO",
]);

/** Countries offered in admin selects (EU/EEA first). */
export const COUNTRY_CODES = [...EU_EEA, "CH", "GB", "US", "CA", "JP", "KR", "SG", "AU", "IN", "AE", "BR", "UA", "RS", "TR"];

export type LocationDisplay = "country" | "region" | "hidden";
export type LocationSource = "measured" | "provider" | "admin";

export interface GarageLocation {
  garage_name: string;
  country: string | null;
  location_display: LocationDisplay;
  location_source: LocationSource;
  is_endpoint: boolean;
  live_hours_per_week: number | null;
}

export const flagEmoji = (code: string) =>
  /^[A-Z]{2}$/i.test(code) ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "";

export const countryName = (code: string) => {
  try { return new Intl.DisplayNames([currentLanguage?.() || "en"], { type: "region" }).of(code.toUpperCase()) ?? code; }
  catch { return code; }
};

export const isEu = (code: string | null | undefined) => !!code && EU_EEA.has(code.toUpperCase());

/** A garage qualifies for "EU only" when its effective country is EU/EEA and the location is not hidden. */
export const qualifiesEu = (l: GarageLocation | undefined) => !!l && l.location_display !== "hidden" && isEu(l.country);

export interface LocationLabel { text: string; tooltip: string | null }

/** Display label respecting location_display; null when hidden or unknown. */
export const locationLabel = (l: GarageLocation | undefined): { flag: string; name: string; suffix: string | null; kind: LocationSource | "region" } | null => {
  if (!l || l.location_display === "hidden" || !l.country) return null;
  if (l.location_display === "region") return isEu(l.country) ? { flag: "🇪🇺", name: "EU", suffix: null, kind: "region" } : { flag: "🌍", name: "Outside EU", suffix: null, kind: "region" };
  const suffix = l.location_source === "admin" ? "admin set" : l.location_source === "provider" ? "provider" : "measured";
  return { flag: flagEmoji(l.country), name: countryName(l.country), suffix, kind: l.location_source };
};
