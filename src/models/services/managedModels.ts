// Client-side access to the shared managed-model rules (same code as node-heartbeat), plus the Add list.
export * from "../../../supabase/functions/_shared/managedModels.ts";
import { estimatedSizeGb, fitsMemory, isOpen, type ManagedRow } from "../../../supabase/functions/_shared/managedModels.ts";
import { paramsB } from "./poolPricing";

export interface ModelCandidate {
  model: string;        // public name
  tag: string;          // Ollama tag Bridge pulls
  sizeGb: number | null;
  fits: boolean;
  garages: number;
  requestsPerDay: number;
  market: { input: number; output: number } | null;
}

export interface CandidateInput {
  fetchable: Array<{ model_name: string; ollama_tag: string | null }>;
  memoryGb: number | null;
  installed: string[];               // runtime ids already on the garage
  managed: ManagedRow[];
  garagesPerModel: Map<string, number>;
  demand: Map<string, number>;       // requests over 7 days
  market: Map<string, { input: number; output: number }>;
}

/** Curated models the garage can fetch: fitting ones first, most requested first. */
export function buildCandidates(i: CandidateInput): ModelCandidate[] {
  const have = new Set([...i.installed, ...i.managed.filter((m) => m.action === "pull").map((m) => m.model)]);
  return i.fetchable
    .filter((r) => r.ollama_tag && !have.has(r.ollama_tag))
    .map((r) => {
      const b = paramsB(r.model_name) ?? paramsB(r.ollama_tag!);
      return { model: r.model_name, tag: r.ollama_tag!, sizeGb: b != null ? estimatedSizeGb(b) : null, fits: fitsMemory(b, i.memoryGb),
        garages: i.garagesPerModel.get(r.model_name) ?? 0, requestsPerDay: Math.round((i.demand.get(r.model_name) ?? 0) / 7), market: i.market.get(r.model_name) ?? null };
    })
    .sort((a, b) => Number(b.fits) - Number(a.fits) || b.requestsPerDay - a.requestsPerDay || a.model.localeCompare(b.model));
}

/** 2–3 fitting models with demand, for "Recommended for you". */
export const recommend = (c: ModelCandidate[], n = 3) => c.filter((x) => x.fits && x.requestsPerDay > 0).slice(0, n);

/** "Runs models up to ~N B well" from memory. */
export const maxParamsB = (memoryGb: number | null) => memoryGb && memoryGb > 2 ? Math.floor((memoryGb - 2) / 0.6) : null;

export const progressGb = (mb: number | null | undefined) => mb == null ? null : Math.round((mb / 1024) * 10) / 10;
export const openEntries = (rows: ManagedRow[]) => rows.filter(isOpen);
