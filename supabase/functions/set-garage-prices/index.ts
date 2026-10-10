import { corsHeaders, getCaller, json, NAME_RE } from "../_shared/garageAuth.ts";
import { syncModels } from "../_shared/syncModels.ts";
import { z } from "npm:zod@3";

const price = z.number().finite().min(0).max(10000);
/** null = use the default (25 % of that row's input price). */
const cachePrice = price.nullable().optional();
const schema = z.object({
  name: z.string().regex(NAME_RE),
  prices: z.object({
    pool_input_cost_per_million: price, pool_output_cost_per_million: price,
    dedicated_input_cost_per_million: price, dedicated_output_cost_per_million: price,
    pool_cache_read_cost_per_million: cachePrice, dedicated_cache_read_cost_per_million: cachePrice,
  }),
  /** Per-model cache-read overrides; null clears the override (falls back to the garage price or default). */
  model_prices: z.array(z.object({ model: z.string().min(1).max(128), pool_cache_read_cost_per_million: cachePrice, dedicated_cache_read_cost_per_million: cachePrice })).max(200).optional(),
});
const within = (c: number | null | undefined, input: number) => c == null || c <= input;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const caller = await getCaller(req);
    if (caller instanceof Response) return caller;
    if (!caller.isAdmin) return json({ error: "Forbidden" }, 403);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Enter valid, non-negative USD prices." }, 400);
    const p = parsed.data.prices;
    const rows = [p, ...(parsed.data.model_prices || [])];
    if (rows.some((r) => !within(r.pool_cache_read_cost_per_million, p.pool_input_cost_per_million) || !within(r.dedicated_cache_read_cost_per_million, p.dedicated_input_cost_per_million)))
      return json({ error: "Cache-read price must be between 0 and the input price." }, 400);
    // Use the caller's JWT for this atomic update so the audit trigger records changed_by.
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.0");
    const client = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "", { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const update = { ...p, pool_cache_read_cost_per_million: p.pool_cache_read_cost_per_million ?? null, dedicated_cache_read_cost_per_million: p.dedicated_cache_read_cost_per_million ?? null };
    const { data, error } = await client.from("garages").update(update).eq("name", parsed.data.name).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "Garage not found" }, 404);
    for (const m of parsed.data.model_prices || []) {
      const { error: mErr } = await caller.admin.from("garage_models").update({ pool_cache_read_cost_per_million: m.pool_cache_read_cost_per_million ?? null, dedicated_cache_read_cost_per_million: m.dedicated_cache_read_cost_per_million ?? null }).eq("garage_id", data.id).eq("model", m.model);
      if (mErr) throw mErr;
    }
    try { await syncModels(caller.admin, { checkNonGarageHealth: false, enableNewGarageModels: false }); }
    catch { return json({ ok: true, routing_synced: false }); }
    return json({ ok: true, routing_synced: true });
  } catch { return json({ error: "Could not update garage prices" }, 500); }
});
