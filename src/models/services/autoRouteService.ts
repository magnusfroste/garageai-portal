import type { CuratedModel } from "@/models/types/curatedModel.types";
import type { AutoEntryView, AutoRouteEntry, AutoSettings, AutoWarning } from "@/models/types/autoRoute.types";
import type { GarageToolSupport } from "./toolSupportService";
import { modelSupportsTools } from "./toolSupportService";

export const AUTO_CATALOG_ID = "garageai-auto";
export const AUTO_PUBLIC_NAME = "garageai/auto";
export const SMALL_CONTEXT = 128_000;

export const isAutoModel = (m: { id?: string; garage_tier?: string | null }) => m.garage_tier === "auto" || m.id === AUTO_CATALOG_ID;

export function parseAutoSettings(raw: unknown): AutoSettings {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const num = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  return {
    public_name: typeof o.public_name === "string" && o.public_name ? o.public_name : AUTO_PUBLIC_NAME,
    input_cost_per_million: num(o.input_cost_per_million),
    output_cost_per_million: num(o.output_cost_per_million),
    cache_read_cost_per_million: num(o.cache_read_cost_per_million),
    enabled: o.enabled !== false,
  };
}

/** Price errors for the auto price form (0 ≤ cache read ≤ input). */
export function autoPriceError(s: AutoSettings): string | null {
  const vals = [s.input_cost_per_million, s.output_cost_per_million, s.cache_read_cost_per_million];
  if (vals.some((v) => v != null && v < 0)) return "Prices cannot be negative";
  if (s.cache_read_cost_per_million != null && s.input_cost_per_million != null && s.cache_read_cost_per_million > s.input_cost_per_million) return "Cache read cannot exceed the input price";
  return null;
}

/** Runtime model shown to admins: the part of the deployment id between garage and tier. */
const runtimeOf = (row: CuratedModel) => {
  const m = row.garage ? row.id.match(/^.+?__(.+)__(dedicated|pool)$/) : null;
  return m ? m[1] : row.model_name || row.id;
};

export function buildAutoEntries(entries: AutoRouteEntry[], models: CuratedModel[], tools: GarageToolSupport[], gradeOf: (g: string | null) => string | null): AutoEntryView[] {
  const byId = new Map(models.map((m) => [m.id, m]));
  return [...entries].sort((a, b) => a.position - b.position).map((entry) => {
    if (entry.pool_model) {
      const members = poolMembers(models, entry.pool_model).filter((m) => m.enabled && m.status === "healthy");
      const windows = members.flatMap((m) => m.max_input_tokens != null ? [m.max_input_tokens] : []);
      const context = windows.length ? Math.min(...windows) : null;
      const supportsTools = members.length > 0 && members.every((m) => modelSupportsTools(tools, `garage/${m.garage}/${entry.pool_model}`));
      const warnings: AutoWarning[] = [];
      if (!supportsTools) warnings.push("no_tools");
      if (context == null || context < SMALL_CONTEXT) warnings.push("small_context");
      if (members.some((m) => gradeOf(m.garage) !== "A")) warnings.push("low_grade");
      const first = members[0];
      return { entry, label: entry.pool_model, garage: `any garage (${members.length})`, tier: "pool", runtimeModel: "—", status: members.length ? "healthy" : "unhealthy", grade: null, supportsTools, context,
        price: { input: first?.input_cost_per_million ?? null, output: first?.output_cost_per_million ?? null, cacheRead: first?.cache_read_cost_per_million ?? null }, missing: !members.length, warnings, members: members.map((m) => m.garage || m.provider) };
    }
    const row = entry.curated_model_id ? byId.get(entry.curated_model_id) : undefined;
    const grade = row?.garage ? gradeOf(row.garage) : null;
    const base = row ? (row.garage_tier === "dedicated" && row.garage ? `garage/${row.garage}/${(row.model_name || "").replace(`garage/${row.garage}/`, "")}` : row.model_name || row.id) : entry.curated_model_id || "—";
    const supportsTools = row ? modelSupportsTools(tools, base) : false;
    const context = row?.max_input_tokens ?? null;
    const warnings: AutoWarning[] = [];
    if (!supportsTools) warnings.push("no_tools");
    if (context == null || context < SMALL_CONTEXT) warnings.push("small_context");
    if (row?.garage && grade !== "A") warnings.push("low_grade");
    return {
      entry, label: row?.model_name || entry.curated_model_id || "—", garage: row?.garage ?? row?.provider ?? null, tier: row?.garage_tier ?? null,
      runtimeModel: row ? runtimeOf(row) : "—", status: row ? (row.enabled ? row.status : "disabled") : "missing", grade, supportsTools, context,
      price: { input: row?.input_cost_per_million ?? null, output: row?.output_cost_per_million ?? null, cacheRead: row?.cache_read_cost_per_million ?? null },
      missing: !row, warnings,
    };
  });
}

export function autoSummary(views: AutoEntryView[]) {
  const live = views.filter((v) => v.entry.enabled && !v.missing);
  const ctx = live.map((v) => v.context).filter((n): n is number => n != null);
  return { count: live.length, minContext: ctx.length ? Math.min(...ctx) : null, tools: live.length > 0 && live.every((v) => v.supportsTools) };
}

/** Swap positions of two neighbours (up/down). */
export function swapPositions(views: AutoEntryView[], index: number, dir: -1 | 1): Array<{ id: string; position: number }> | null {
  const j = index + dir;
  if (j < 0 || j >= views.length) return null;
  const a = views[index].entry, b = views[j].entry;
  const pa = a.position === b.position ? a.position + dir : b.position;
  return [{ id: a.id, position: pa }, { id: b.id, position: a.position }];
}

/** Models that can be added: enabled garage/provider rows not already in the list. */
export const addableModels = (models: CuratedModel[], entries: AutoRouteEntry[]) => {
  const used = new Set(entries.map((e) => e.curated_model_id));
  return models.filter((m) => m.enabled && !!m.garage && !used.has(m.id) && !isAutoModel(m));
};

/** Picker presentation only; keep the existing enabled/garage eligibility rule. */
export const poolMembers = (models: CuratedModel[], name: string) => models.filter((m) => !!m.garage && m.garage_tier === "pool" && m.model_name === name);
export const autoEntryValue = (entry: Pick<AutoRouteEntry, "curated_model_id" | "pool_model">) => entry.pool_model ? `pool:${entry.pool_model}` : entry.curated_model_id || "";
export const autoSelection = (value: string) => value.startsWith("pool:") ? { curated_model_id: null, pool_model: value.slice(5) } : { curated_model_id: value, pool_model: null };

const priceRange = (members: CuratedModel[], field: "input_cost_per_million" | "output_cost_per_million") => {
  const values = members.flatMap((m) => m[field] != null ? [m[field]] : []);
  if (!values.length) return "—";
  const low = Math.min(...values), high = Math.max(...values);
  return low === high ? String(low) : `${low}–${high}`;
};

export function autoModelOptions(models: CuratedModel[], entries: AutoRouteEntry[], currentEntryId?: string) {
  const used = new Set(entries.filter((e) => e.id !== currentEntryId).map((e) => e.curated_model_id));
  const singles = models.filter((m) => !!m.garage && !isAutoModel(m)).map((model) => ({
    model,
    poolModel: null as string | null,
    inputLabel: String(model.input_cost_per_million ?? "—"),
    outputLabel: String(model.output_cost_per_million ?? "—"),
    name: model.garage_tier === "dedicated" ? (model.model_name || model.id).replace(`garage/${model.garage}/`, "") : model.model_name || model.id,
    supplier: model.garage || model.provider,
    tier: model.garage_tier || "—",
    alreadyInAuto: used.has(model.id),
    down: !model.enabled || model.status !== "healthy",
    disabled: !model.enabled || used.has(model.id),
  }));
  const pools = [...new Set(models.filter((m) => !!m.garage && !isAutoModel(m) && m.garage_tier === "pool" && m.model_name).map((m) => m.model_name))].flatMap((name) => {
    if (!name) return [];
    const members = poolMembers(models, name);
    const first = members[0];
    if (!first) return [];
    const alreadyInAuto = entries.some((e) => e.id !== currentEntryId && e.pool_model === name);
    const windows = members.flatMap((m) => m.max_input_tokens != null ? [m.max_input_tokens] : []);
    return [{ model: { ...first, id: `pool:${name}`, max_input_tokens: windows.length ? Math.max(...windows) : null }, poolModel: name, name, supplier: `any garage (${members.length})`, tier: "pool", inputLabel: priceRange(members, "input_cost_per_million"), outputLabel: priceRange(members, "output_cost_per_million"), alreadyInAuto, down: !members.some((m) => m.enabled && m.status === "healthy"), disabled: alreadyInAuto }];
  });
  return [...singles, ...pools].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.supplier.localeCompare(b.supplier) || (a.tier === "pool" ? 0 : a.tier === "dedicated" ? 1 : 2) - (b.tier === "pool" ? 0 : b.tier === "dedicated" ? 1 : 2) || a.model.id.localeCompare(b.model.id));
}

export const filterAutoModelOptions = (options: ReturnType<typeof autoModelOptions>, query: string) => {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return options.filter((o) => words.every((word) => `${o.name} ${o.supplier} ${o.tier} ${o.model.provider}`.toLowerCase().includes(word)));
};

/** Next free position at the end of the list (always ≥ 1). */
export const nextAutoPosition = (entries: Array<{ position: number }>) => Math.max(0, ...entries.map((e) => e.position)) + 1;

/** Readable message from a failed save (database or network error). */
export const autoErrorMessage = (e: unknown): string => {
  const o = e && typeof e === "object" ? e as { message?: unknown; details?: unknown } : null;
  const m = typeof o?.message === "string" && o.message ? o.message : e instanceof Error ? e.message : String(e ?? "Unknown error");
  return /duplicate key/.test(m) ? "This model is already in the list" : m;
};
