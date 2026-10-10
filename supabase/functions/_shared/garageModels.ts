// Garage model inventory: installed (reported by the node) vs offered (operator choice).
// Only offered models may be routed in LiteLLM.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const EMBEDDING_RE = /embed|bge-|bge:|e5-|minilm|rerank|colbert|gte-/i;
export const isEmbeddingModel = (model: string) => EMBEDDING_RE.test(model);

type Row = { garage_id: string; model: string; installed: boolean; offered: boolean; status: string };

/** Writes the reported inventory. First registration offers everything reported (except embeddings); later new models are not auto-offered. */
export async function syncInventory(admin: SupabaseClient, garageId: string, models: string[]): Promise<Set<string>> {
  const { data } = await admin.from("garage_models").select("garage_id, model, installed, offered, status").eq("garage_id", garageId);
  const rows = (data || []) as Row[];
  const first = rows.length === 0;
  const byModel = new Map(rows.map((r) => [r.model, r]));
  const now = new Date().toISOString();
  const upserts = models.map((model) => {
    const prev = byModel.get(model);
    return { garage_id: garageId, model, installed: true, offered: prev ? prev.offered && !isEmbeddingModel(model) : first && !isEmbeddingModel(model), status: prev?.status ?? "untested", updated_at: now };
  });
  if (upserts.length) await admin.from("garage_models").upsert(upserts, { onConflict: "garage_id,model" });
  const gone = rows.filter((r) => r.installed && !models.includes(r.model)).map((r) => r.model);
  if (gone.length) await admin.from("garage_models").update({ installed: false, updated_at: now }).eq("garage_id", garageId).in("model", gone);
  return new Set(upserts.filter((u) => u.offered).map((u) => u.model));
}

/** garage_id -> offered, installed and not paused models. Garages without inventory rows are absent (legacy: everything offered). */
export async function offeredByGarage(admin: SupabaseClient, garageIds: string[]) {
  const map = new Map<string, Set<string>>();
  if (!garageIds.length) return map;
  const { data } = await admin.from("garage_models").select("garage_id, model, offered, installed, paused_at").in("garage_id", garageIds);
  for (const r of (data || []) as Row[]) {
    if (!map.has(r.garage_id)) map.set(r.garage_id, new Set());
    if (r.offered && r.installed && !(r as Row & { paused_at?: string | null }).paused_at) map.get(r.garage_id)!.add(r.model);
  }
  return map;
}

export async function markTestStatus(admin: SupabaseClient, garageId: string, results: Array<{ model: string; passed: boolean; inconclusive?: boolean }>) {
  const now = new Date().toISOString();
  for (const r of results) {
    if (r.inconclusive) continue;
    await admin.from("garage_models").update({ status: r.passed ? "live" : "failed", updated_at: now }).eq("garage_id", garageId).eq("model", r.model).eq("offered", true);
  }
}

/** "garage_id::model" for models the operator paused (per-model pause). */
export async function pausedModels(admin: SupabaseClient, garageIds: string[]) {
  const set = new Set<string>();
  if (!garageIds.length) return set;
  const { data } = await admin.from("garage_models").select("garage_id, model").in("garage_id", garageIds).not("paused_at", "is", null);
  for (const r of (data || []) as Array<{ garage_id: string; model: string }>) set.add(`${r.garage_id}::${r.model}`);
  return set;
}

export const CONTEXT_MIN = 512;
export const CONTEXT_MAX = 4_194_304;
export const CONTEXTS_MAX_ENTRIES = 200;

/** Models (of this garage) whose reported context differs from the stored one. Never treats "not reported" as a change. */
export async function changedContexts(admin: SupabaseClient, garageId: string, contexts: Record<string, number>): Promise<Record<string, number>> {
  const models = Object.keys(contexts);
  if (!models.length) return {};
  const { data } = await admin.from("garage_models").select("model, context_length").eq("garage_id", garageId).in("model", models);
  const stored = new Map(((data || []) as Array<{ model: string; context_length: number | null }>).map((r) => [r.model, r.context_length]));
  const out: Record<string, number> = {};
  for (const [m, v] of Object.entries(contexts)) if (stored.get(m) !== v) out[m] = v;
  return out;
}

/** Writes reported context windows to existing garage_models rows; unreported models keep their stored value. */
export async function storeContexts(admin: SupabaseClient, garageId: string, contexts: Record<string, number>): Promise<void> {
  const changed = await changedContexts(admin, garageId, contexts);
  for (const [model, context_length] of Object.entries(changed)) {
    await admin.from("garage_models").update({ context_length }).eq("garage_id", garageId).eq("model", model);
  }
}
