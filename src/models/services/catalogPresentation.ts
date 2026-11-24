import type { CatalogModel, GarageOffer, GarageSupplyFact, ModelDailyStat } from "@/models/types/catalog.types";
import { flagEmoji, countryName, locationLabel, qualifiesEu, type GarageLocation } from "./location";

/** Author from the `<creator>/<model>` name, e.g. qwen/qwen3 → Qwen. */
export const modelAuthor = (name: string): string | null => {
  const i = name.indexOf("/");
  if (i <= 0) return null;
  const c = name.slice(0, i);
  return c.length <= 3 ? c.toUpperCase() : c.charAt(0).toUpperCase() + c.slice(1);
};

/** Offers counted as "up": online ones, or all when none are online. */
const upOffers = (m: CatalogModel) => {
  const on = m.offers.filter((o) => o.online);
  return on.length ? on : m.offers;
};

/** Largest context among garages that are up, and whether they differ. */
export const modelContext = (m: CatalogModel): { value: number | null; varies: boolean } => {
  const vals = upOffers(m).map((o) => o.contextLength).filter((v): v is number => v != null);
  if (!vals.length) return { value: m.contextLength, varies: false };
  return { value: Math.max(...vals), varies: new Set(vals).size > 1 };
};

/** "From" price: cheapest garage that is up (falls back to catalogue minimum). */
export const fromPrice = (m: CatalogModel): { input: number | null; output: number | null } => {
  const up = upOffers(m);
  const min = (k: "input" | "output") => {
    const v = up.map((o) => o.price[k]).filter((x): x is number => x != null).map(Number);
    return v.length ? Math.min(...v) : m.minPrice[k] ?? null;
  };
  return { input: min("input"), output: min("output") };
};

export const modelModalities = (m: CatalogModel): { input: string[]; output: string[] } =>
  m.mode === "embedding" ? { input: ["text"], output: ["embeddings"] } : { input: ["text"], output: ["text"] };

/** Generated short description (no stored model descriptions exist). */
export const modelDescription = (m: CatalogModel): string => {
  if (m.auto) return "Picks the best available model for each request and switches automatically if one is busy. Recommended for coding tools.";
  const n = m.offers.length;
  const parts = [`${m.name} served by ${n} ${n === 1 ? "garage or provider" : "garages and providers"} on GarageAI.`];
  if (m.supportsTools) parts.push("Supports tool calling.");
  if (m.pool) parts.push("Requests are spread across the garages that are up, weighted by price.");
  return parts.join(" ");
};

export interface OfferPlace { flag: string | null; text: string }

// ---------- where it runs ----------
export const PROVIDER_REGIONS = ["se", "eu", "other"] as const;
export type ProviderRegion = typeof PROVIDER_REGIONS[number];
/** Admin-set provider region → flag and label. */
export const regionPlace = (r: ProviderRegion | null): OfferPlace =>
  r === "se" ? { flag: flagEmoji("SE"), text: "Sweden" }
  : r === "eu" ? { flag: "🇪🇺", text: "Europe" }
  : r === "other" ? { flag: "🌐", text: "Other" }
  : { flag: null, text: "Unknown" };
export type WhereFilter = "se" | "eu";
export const parseWhere = (v: string | null): WhereFilter | null => (v === "se" || v === "eu" ? v : null);
/** Strongest "where it runs" class: providers by admin region, garages by measured/declared country (hidden = none). */
export const whereClass = (o: { isProvider?: boolean; providerRegion?: ProviderRegion | null; location?: GarageLocation | null }): WhereFilter | null => {
  if (o.isProvider || o.location?.is_endpoint) return o.providerRegion === "se" ? "se" : o.providerRegion === "eu" ? "eu" : null;
  const l = o.location ?? undefined;
  if (!qualifiesEu(l)) return null;
  return l!.country?.toUpperCase() === "SE" && l!.location_display === "country" ? "se" : "eu";
};
/** Europe includes Sweden. */
export const matchesWhere = (cls: WhereFilter | null, f: WhereFilter | null) => !f || (f === "se" ? cls === "se" : cls != null);
/** Where the answer is produced. Forwarding providers vary and get no flag. */
export const offerPlace = (o: Pick<GarageOffer, "forwardsTo" | "location"> & { providerRegion?: ProviderRegion | null; isProvider?: boolean }): OfferPlace => {
  if (o.isProvider || o.location?.is_endpoint) return regionPlace(o.providerRegion ?? null);
  if (o.forwardsTo) return { flag: null, text: "varies" };
  const l = locationLabel(o.location ?? undefined);
  return l ? { flag: l.flag, text: l.name } : { flag: null, text: "—" };
};

/** Country codes a model's (non-forwarding) garages run in, plus "varies". */
export const offerCountries = (m: CatalogModel): string[] =>
  [...new Set(m.offers.map((o) => (o.forwardsTo ? "varies" : o.location?.location_display !== "hidden" ? o.location?.country ?? null : null)).filter((c): c is string => !!c))];

export const countryOptionLabel = (c: string) => (c === "varies" ? "Varies" : `${flagEmoji(c)} ${countryName(c)}`);

export const withForwarding = (models: CatalogModel[], supply: GarageSupplyFact[]): CatalogModel[] => {
  const by = new Map(supply.map((s) => [s.garage_name, s]));
  return models.map((m) => ({ ...m, offers: m.offers.map((o) => {
    const s = by.get(o.garage);
    const isProvider = !!(s?.is_endpoint || o.location?.is_endpoint);
    return { ...o, forwardsTo: s?.forwards_to ?? null, isProvider, providerRegion: isProvider ? s?.provider_region ?? null : undefined };
  }) }));
};

/** Tokens (prompt + completion) per model, last 30 days. */
export const tokens30dByModel = (rows: ModelDailyStat[]): Map<string, number> => {
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.model, (out.get(r.model) ?? 0) + r.promptTokens + r.completionTokens);
  return out;
};

/** Weighted average price actually paid per 1M tokens over 30 days; null without traffic. */
export const paidAverage = (rows: ModelDailyStat[], model: string): { input: number | null; output: number | null } => {
  const r = rows.filter((x) => x.model === model);
  const pt = r.reduce((s, x) => s + x.promptTokens, 0), ct = r.reduce((s, x) => s + x.completionTokens, 0);
  const is = r.reduce((s, x) => s + x.inputSpend, 0), os = r.reduce((s, x) => s + x.outputSpend, 0);
  return { input: pt > 0 ? (is / pt) * 1e6 : null, output: ct > 0 ? (os / ct) * 1e6 : null };
};

/** 30 days of daily totals for one model (zeros filled). */
export const modelActivity = (rows: ModelDailyStat[], model: string) => {
  const by = new Map<string, ModelDailyStat>();
  for (const r of rows) if (r.model === model) by.set(r.day, r);
  return Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 86400_000).toISOString().slice(0, 10);
    const r = by.get(day);
    return { day, tokens: r ? r.promptTokens + r.completionTokens : 0, requests: r?.requests ?? 0 };
  });
};

// ---------- catalogue filters (left panel) ----------
export interface CatalogPanelFilters {
  modality: string | null;
  tools: boolean;
  country: string | null;
  where: WhereFilter | null;
  supply: "garage" | "provider" | null;
}
export const panelFromParams = (p: URLSearchParams): CatalogPanelFilters => ({
  modality: p.get("modality"),
  tools: p.get("tools") === "1",
  country: p.get("country"),
  where: parseWhere(p.get("where")),
  supply: p.get("supply") === "garage" || p.get("supply") === "provider" ? (p.get("supply") as "garage" | "provider") : null,
});
export const applyPanel = (models: CatalogModel[], f: CatalogPanelFilters) => models.filter((m) => {
  if (m.auto) return !f.modality && !f.country && !f.where && !f.supply;
  if (f.modality && !modelModalities(m).input.includes(f.modality)) return false;
  if (f.tools && !m.supportsTools) return false;
  if (f.country && !offerCountries(m).includes(f.country)) return false;
  if (f.where && !m.offers.some((o) => matchesWhere(whereClass(o), f.where))) return false;
  if (f.supply && !m.offers.some((o) => (f.supply === "provider") === !!o.location?.is_endpoint)) return false;
  return true;
});

// ---------- public supply list ----------
export interface SupplyRow {
  name: string;
  displayName: string;
  kind: "garage" | "provider";
  countryCode: string | null; // null when hidden or forwarding
  place: OfferPlace;
  forwardsTo: string | null;
  where: WhereFilter | null;
  termsAccepted: boolean;
  tokens1d: number;
  tokens30d: number;
  models: string[];
}
export interface SupplyFilters { q: string; kind: "garage" | "provider" | null; country: string | null; where?: WhereFilter | null; terms: boolean }
export const filterSupply = (rows: SupplyRow[], f: SupplyFilters) => {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) =>
    (!q || r.name.toLowerCase().includes(q) || r.displayName.toLowerCase().includes(q) || r.models.some((m) => m.toLowerCase().includes(q)))
    && (!f.kind || r.kind === f.kind)
    && (!f.country || (f.country === "varies" ? !!r.forwardsTo : r.countryCode === f.country))
    && matchesWhere(r.where, f.where ?? null)
    && (!f.terms || r.termsAccepted));
};
