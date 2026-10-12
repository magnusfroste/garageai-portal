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
    const row = byId.get(entry.curated_model_id);
    const grade = row?.garage ? gradeOf(row.garage) : null;
    const base = row ? (row.garage_tier === "dedicated" && row.garage ? `garage/${row.garage}/${(row.model_name || "").replace(`garage/${row.garage}/`, "")}` : row.model_name || row.id) : entry.curated_model_id;
    const supportsTools = row ? modelSupportsTools(tools, base) : false;
    const context = row?.max_input_tokens ?? null;
    const warnings: AutoWarning[] = [];
    if (!supportsTools) warnings.push("no_tools");
    if (context == null || context < SMALL_CONTEXT) warnings.push("small_context");
    if (row?.garage && grade !== "A") warnings.push("low_grade");
    return {
      entry, label: row?.model_name || entry.curated_model_id, garage: row?.garage ?? row?.provider ?? null, tier: row?.garage_tier ?? null,
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

/** Next free position at the end of the list (always ≥ 1). */
export const nextAutoPosition = (entries: Array<{ position: number }>) => Math.max(0, ...entries.map((e) => e.position)) + 1;

/** Readable message from a failed save (database or network error). */
export const autoErrorMessage = (e: unknown): string => {
  const o = e && typeof e === "object" ? e as { message?: unknown; details?: unknown } : null;
  const m = typeof o?.message === "string" && o.message ? o.message : e instanceof Error ? e.message : String(e ?? "Unknown error");
  return /duplicate key/.test(m) ? "This model is already in the list" : m;
};
