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

/** garage_id -> offered models. Garages without inventory rows are absent (legacy: everything offered). */
export async function offeredByGarage(admin: SupabaseClient, garageIds: string[]) {
  const map = new Map<string, Set<string>>();
  if (!garageIds.length) return map;
  const { data } = await admin.from("garage_models").select("garage_id, model, offered, installed").in("garage_id", garageIds);
  for (const r of (data || []) as Row[]) {
    if (!map.has(r.garage_id)) map.set(r.garage_id, new Set());
    if (r.offered && r.installed) map.get(r.garage_id)!.add(r.model);
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
