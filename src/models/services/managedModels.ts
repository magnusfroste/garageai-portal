// Client-side access to the shared managed-model rules (same code as node-heartbeat), plus the Add list.
export * from "../../../supabase/functions/_shared/managedModels.ts";
import { bytesToGb, estimatedSizeGb, fitsMemory, fitsTogether, isOpen, type ManagedRow } from "../../../supabase/functions/_shared/managedModels.ts";
import { paramsB } from "./poolPricing";

export interface ModelCandidate {
  model: string;        // public name
  tag: string;          // Ollama tag Bridge pulls
  sizeGb: number | null;
  /** True when sizeGb is the parameter estimate, not the registry's real size. */
  sizeEstimated: boolean;
  fits: boolean;
  /** Fits alongside the installed models; false = they will swap. */
  fitsWithOthers: boolean;
  swapsWith: string[];
  garages: number;
  requestsPerDay: number;
  market: { input: number; output: number } | null;
}

export interface CandidateInput {
  fetchable: Array<{ model_name: string; ollama_tag: string | null; download_bytes?: number | null }>;
  memoryGb: number | null;
  installed: string[];               // runtime ids already on the garage
  managed: ManagedRow[];
  garagesPerModel: Map<string, number>;
  demand: Map<string, number>;       // requests over 7 days
  market: Map<string, { input: number; output: number }>;
}

/** Real registry size when known, else the estimate (labelled). */
export function sizeOf(tag: string, modelName: string | null, bytes: number | null | undefined): { sizeGb: number | null; estimated: boolean } {
  if (bytes != null && bytes > 0) return { sizeGb: bytesToGb(bytes), estimated: false };
  const b = (modelName ? paramsB(modelName) : null) ?? paramsB(tag);
  return { sizeGb: b != null ? estimatedSizeGb(b) : null, estimated: true };
}

/** Curated models the garage can fetch: fitting ones first, most requested first. */
export function buildCandidates(i: CandidateInput): ModelCandidate[] {
  const have = new Set([...i.installed, ...i.managed.filter((m) => m.action === "pull").map((m) => m.model)]);
  const bytesByTag = new Map(i.fetchable.filter((r) => r.ollama_tag).map((r) => [r.ollama_tag!, r]));
  const current = [...have].map((tag) => ({ tag, gb: sizeOf(tag, bytesByTag.get(tag)?.model_name ?? null, bytesByTag.get(tag)?.download_bytes).sizeGb ?? 0 }));
  return i.fetchable
    .filter((r) => r.ollama_tag && !have.has(r.ollama_tag))
    .map((r) => {
      const { sizeGb, estimated } = sizeOf(r.ollama_tag!, r.model_name, r.download_bytes);
      const fits = fitsMemory(sizeGb, i.memoryGb);
      const fitsWithOthers = fits && fitsTogether(sizeGb, current.map((c) => c.gb), i.memoryGb);
      return { model: r.model_name, tag: r.ollama_tag!, sizeGb, sizeEstimated: estimated, fits, fitsWithOthers, swapsWith: fits && !fitsWithOthers ? current.map((c) => c.tag) : [],
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
