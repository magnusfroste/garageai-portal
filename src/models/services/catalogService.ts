import type { GarageToolSupport } from "./toolSupportService";
import type { CuratedModel } from "@/models/types/curatedModel.types";
import type { GarageReliability, ReliabilityGrade } from "@/models/types/reliability.types";
import type {
  CatalogFilters, CatalogModel, CatalogSort, GarageDailyTokens, GarageOffer, GaragePublicStat, Price,
} from "@/models/types/catalog.types";
import { bestGrade } from "./reliabilityService";

const GRADE_RANK: Record<ReliabilityGrade, number> = { Nytt: 0, D: 1, C: 2, B: 3, A: 4 };

/** Base model name: dedicated rows are named `garage/<garage>/<model>`. */
export const baseModelName = (row: Pick<CuratedModel, "model_name" | "id" | "garage">): string => {
  const name = row.model_name || row.id;
  const prefix = row.garage ? `garage/${row.garage}/` : null;
  return prefix && name.startsWith(prefix) ? name.slice(prefix.length) : name;
};

const minOf = (vals: (number | null)[]) => {
  const v = vals.filter((x): x is number => x != null);
  return v.length ? Math.min(...v) : null;
};
const maxOf = (vals: (number | null)[]) => {
  const v = vals.filter((x): x is number => x != null);
  return v.length ? Math.max(...v) : null;
};

export const buildCatalog = (
  rows: CuratedModel[],
  stats: GaragePublicStat[],
  reliability: Map<string, GarageReliability>,
  tools: GarageToolSupport[] = [],
): CatalogModel[] => {
  const statOf = new Map(stats.map((s) => [s.garage_name, s]));
  const groups = new Map<string, CuratedModel[]>();
  for (const r of rows.filter((r) => r.enabled)) {
    const k = baseModelName(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  const out: CatalogModel[] = [];
  for (const [name, list] of groups) {
    const pool = list.find((r) => r.garage_tier === "pool") ?? list.find((r) => !r.garage) ?? null;
    const garages = [...new Set(list.map((r) => r.garage).filter((g): g is string => !!g))];
    const offers: GarageOffer[] = garages.map((g) => {
      const ded = list.find((r) => r.garage === g && r.garage_tier === "dedicated");
      const any = ded ?? list.find((r) => r.garage === g)!;
      const rel = reliability.get(g);
      const st = statOf.get(g);
      return {
        garage: g,
        modelId: ded ? ded.model_name || ded.id : null,
        price: { input: any.input_cost_per_million, output: any.output_cost_per_million },
        grade: rel?.grade ?? null,
        score: rel?.score ?? null,
        ttftMs: rel?.windows["30d"]?.ttft_ms_p50 ?? null,
        tokensPerSecond: rel?.windows["30d"]?.tokens_per_second ?? null,
        availability30d: rel?.windows["30d"]?.availability ?? null,
        online: (st?.online ?? false) && list.some((r) => r.garage === g && r.status !== "unhealthy"),
        runtime: st?.runtime ?? null,
        tokens7d: st?.tokens_7d ?? 0,
      };
    });
    const allPrices = list.map((r) => ({ i: r.input_cost_per_million, o: r.output_cost_per_million }));
    const avail = offers.map((o) => o.availability30d).filter((a): a is number => a != null);
    const ref = pool ?? list[0];
    out.push({
      name,
      poolId: pool ? pool.model_name || pool.id : null,
      provider: ref.provider,
      mode: ref.mode,
      contextLength: maxOf(list.map((r) => r.max_input_tokens)),
      maxOutput: maxOf(list.map((r) => r.max_output_tokens)),
      huggingfaceUrl: list.find((r) => r.huggingface_url)?.huggingface_url ?? null,
      poolPrice: pool ? { input: pool.input_cost_per_million, output: pool.output_cost_per_million } : null,
      minPrice: { input: minOf(allPrices.map((p) => p.i)), output: minOf(allPrices.map((p) => p.o)) },
      maxPrice: { input: maxOf(allPrices.map((p) => p.i)), output: maxOf(allPrices.map((p) => p.o)) },
      offers,
      bestGrade: bestGrade(offers.map((o) => o.grade).filter((g): g is ReliabilityGrade => !!g)),
      available: offers.length ? offers.some((o) => o.online) : list.some((r) => r.status !== "unhealthy"),
      // Pool is up when any garage is up: 1 − Π(1 − aᵢ)
      poolAvailability: avail.length ? 1 - avail.reduce((p, a) => p * (1 - a), 1) : null,
      tokens7d: offers.reduce((s, o) => s + o.tokens7d, 0),
      tokensPerSecond: maxOf(offers.map((o) => o.tokensPerSecond)),
      supportsTools: tools.some((t) => t.supports_tools && t.model === name && garages.includes(t.garage_name)),
    });
  }
  return out;
};

export const DEFAULT_FILTERS: CatalogFilters = {
  q: "", minContext: null, maxPrice: null, runtime: null, minGrade: null, multiGarage: false, sort: "popular",
};

const SORTS: CatalogSort[] = ["popular", "cheapest", "fastest", "reliable"];
const GRADES: ReliabilityGrade[] = ["A", "B", "C", "D"];
const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);

export const filtersFromParams = (p: URLSearchParams): CatalogFilters => ({
  q: p.get("q") ?? "",
  minContext: num(p.get("ctx")),
  maxPrice: num(p.get("pris")),
  runtime: p.get("motor"),
  minGrade: GRADES.includes(p.get("betyg") as ReliabilityGrade) ? (p.get("betyg") as ReliabilityGrade) : null,
  multiGarage: p.get("flera") === "1",
  sort: SORTS.includes(p.get("sort") as CatalogSort) ? (p.get("sort") as CatalogSort) : "popular",
});

export const filtersToParams = (f: CatalogFilters): Record<string, string> => {
  const o: Record<string, string> = {};
  if (f.q) o.q = f.q;
  if (f.minContext) o.ctx = String(f.minContext);
  if (f.maxPrice != null) o.pris = String(f.maxPrice);
  if (f.runtime) o.motor = f.runtime;
  if (f.minGrade) o.betyg = f.minGrade;
  if (f.multiGarage) o.flera = "1";
  if (f.sort !== "popular") o.sort = f.sort;
  return o;
};

export const applyFilters = (models: CatalogModel[], f: CatalogFilters): CatalogModel[] => {
  const q = f.q.trim().toLowerCase();
  const res = models.filter((m) => {
    if (q && !m.name.toLowerCase().includes(q) && !m.offers.some((o) => o.garage.toLowerCase().includes(q))) return false;
    if (f.minContext && (m.contextLength ?? 0) < f.minContext) return false;
    if (f.maxPrice != null && (m.minPrice.output ?? Infinity) > f.maxPrice) return false;
    if (f.runtime && !m.offers.some((o) => o.runtime === f.runtime)) return false;
    if (f.minGrade && (!m.bestGrade || GRADE_RANK[m.bestGrade] < GRADE_RANK[f.minGrade])) return false;
    if (f.multiGarage && m.offers.length < 2) return false;
    return true;
  });
  const cmp: Record<CatalogSort, (a: CatalogModel, b: CatalogModel) => number> = {
    popular: (a, b) => b.tokens7d - a.tokens7d,
    cheapest: (a, b) => (a.minPrice.output ?? Infinity) - (b.minPrice.output ?? Infinity),
    fastest: (a, b) => (b.tokensPerSecond ?? -1) - (a.tokensPerSecond ?? -1),
    reliable: (a, b) =>
      (b.bestGrade ? GRADE_RANK[b.bestGrade] : -1) - (a.bestGrade ? GRADE_RANK[a.bestGrade] : -1) ||
      Math.max(-1, ...b.offers.map((o) => o.score ?? -1)) - Math.max(-1, ...a.offers.map((o) => o.score ?? -1)),
  };
  return res.sort((a, b) => cmp[f.sort](a, b) || a.name.localeCompare(b.name));
};

/** Sum of completion tokens per day for the last 30 days (zeros filled). */
export const dailyTotals = (rows: GarageDailyTokens[]): { day: string; tokens: number }[] => {
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.tokens);
  const out: { day: string; tokens: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    out.push({ day: d, tokens: byDay.get(d) ?? 0 });
  }
  return out;
};

export const formatContext = (n: number | null) => {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  return `${Math.round(n / 1000)}k`;
};

export const formatPrice = (v: number | null) => (v == null ? "—" : `$${v}`);

export const priceRange = (min: number | null, max: number | null) =>
  min == null ? "—" : min === max || max == null ? formatPrice(min) : `${formatPrice(min)}–${formatPrice(max)}`;
