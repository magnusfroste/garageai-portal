// Garage model inventory: installed (reported by the node) vs offered (operator choice).
// Only offered models may be routed in LiteLLM.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const EMBEDDING_RE = /embed|bge-|bge:|e5-|minilm|rerank|colbert|gte-/i;
export const isEmbeddingModel = (model: string) => EMBEDDING_RE.test(model);

type Row = { garage_id: string; model: string; installed: boolean; offered: boolean; status: string };
export const PRICE_COLUMNS = ["pool_input_cost_per_million", "pool_output_cost_per_million", "dedicated_input_cost_per_million", "dedicated_output_cost_per_million", "pool_cache_read_cost_per_million", "dedicated_cache_read_cost_per_million"] as const;
export type Remembered = { model: string; offered: boolean } & Partial<Record<typeof PRICE_COLUMNS[number], number | null>>;

/** Offer flag for one reported model. Existing rows and remembered (removed earlier, e.g. during a runtime switch) rows keep their choice; only truly new names start un-offered (except the very first registration). */
export function offerFor(model: string, prev: { offered: boolean } | undefined, remembered: { offered: boolean } | undefined, first: boolean, offerNow: boolean): boolean {
  if (isEmbeddingModel(model)) return false;
  if (offerNow) return true;
  if (prev) return prev.offered;
  if (remembered) return remembered.offered;
  return first;
}

/** Writes the reported inventory. Models in `offer` (fetched on request) are offered at once. First registration offers everything reported (except embeddings); remembered models get their earlier offer choice and prices back; other new models are not auto-offered. */
export async function syncInventory(admin: SupabaseClient, garageId: string, models: string[], offer: string[] = []): Promise<Set<string>> {
  const offerNow = new Set(offer);
  const { data } = await admin.from("garage_models").select("garage_id, model, installed, offered, status").eq("garage_id", garageId);
  const rows = (data || []) as Row[];
  const first = rows.length === 0;
  const byModel = new Map(rows.map((r) => [r.model, r]));
  const fresh = models.filter((m) => !byModel.has(m));
  const memory = new Map<string, Remembered>();
  if (fresh.length) {
    const { data: mem } = await admin.from("garage_model_memory").select(`model, offered, ${PRICE_COLUMNS.join(", ")}`).eq("garage_id", garageId).in("model", fresh);
    for (const m of (mem || []) as unknown as Remembered[]) memory.set(m.model, m);
  }
  // Very first registration with no memory at all = a brand-new garage.
  const firstEver = first && memory.size === 0;
  const now = new Date().toISOString();
  const upserts = models.map((model) => {
    const prev = byModel.get(model);
    const rem = prev ? undefined : memory.get(model);
    const offered = offerFor(model, prev, rem, firstEver, offerNow.has(model));
    if (offerNow.has(model) && offered) return { garage_id: garageId, model, installed: true, offered: true, status: "testing", updated_at: now };
    const prices = rem ? Object.fromEntries(PRICE_COLUMNS.filter((c) => rem[c] != null).map((c) => [c, rem[c]])) : {};
    return { garage_id: garageId, model, installed: true, offered, status: prev?.status ?? "untested", updated_at: now, ...prices };
  });
  for (const u of upserts) await admin.from("garage_models").upsert(u, { onConflict: "garage_id,model" });
  if (memory.size) await admin.from("garage_model_memory").delete().eq("garage_id", garageId).in("model", [...memory.keys()]);
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

/** A model missing from this many consecutive heartbeats is removed from the garage. */
export const MISSING_HEARTBEATS_REMOVE = 3;

/** Heartbeat is the only source of served models: count misses, reset reported ones, remove after N misses. */
export function inventoryMisses(rows: Array<{ model: string; missing_heartbeats: number }>, reported: string[], n = MISSING_HEARTBEATS_REMOVE) {
  const seen = new Set(reported);
  const reset: string[] = [], bump: Array<{ model: string; missing_heartbeats: number }> = [], remove: string[] = [];
  for (const r of rows) {
    if (seen.has(r.model)) { if (r.missing_heartbeats) reset.push(r.model); continue; }
    const next = (r.missing_heartbeats ?? 0) + 1;
    if (next >= n) remove.push(r.model); else bump.push({ model: r.model, missing_heartbeats: next });
  }
  return { reset, bump, remove };
}

export async function applyInventoryMisses(admin: SupabaseClient, garageId: string, reported: string[]) {
  const { data } = await admin.from("garage_models").select("model, missing_heartbeats").eq("garage_id", garageId);
  const { reset, bump, remove } = inventoryMisses((data || []) as Array<{ model: string; missing_heartbeats: number }>, reported);
  if (reset.length) await admin.from("garage_models").update({ missing_heartbeats: 0 }).eq("garage_id", garageId).in("model", reset);
  for (const b of bump) await admin.from("garage_models").update({ missing_heartbeats: b.missing_heartbeats, installed: false }).eq("garage_id", garageId).eq("model", b.model);
  if (remove.length) await admin.from("garage_models").delete().eq("garage_id", garageId).in("model", remove);
  return remove;
}
