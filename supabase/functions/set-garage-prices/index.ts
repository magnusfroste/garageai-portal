import { corsHeaders, getCaller, json, NAME_RE } from "../_shared/garageAuth.ts";
import { syncModels } from "../_shared/syncModels.ts";
import { z } from "npm:zod@3";

const price = z.number().finite().min(0).max(10000);
const schema = z.object({ name: z.string().regex(NAME_RE), prices: z.object({
  pool_input_cost_per_million: price, pool_output_cost_per_million: price,
  dedicated_input_cost_per_million: price, dedicated_output_cost_per_million: price,
}) });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const caller = await getCaller(req);
    if (caller instanceof Response) return caller;
    if (!caller.isAdmin) return json({ error: "Forbidden" }, 403);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Enter four valid, non-negative USD prices." }, 400);
    // Use the caller's JWT for this atomic update so the audit trigger records changed_by.
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.0");
    const client = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "", { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data, error } = await client.from("garages").update(parsed.data.prices).eq("name", parsed.data.name).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "Garage not found" }, 404);
    try { await syncModels(caller.admin, { checkNonGarageHealth: false, enableNewGarageModels: false }); }
    catch { return json({ ok: true, routing_synced: false }); }
    return json({ ok: true, routing_synced: true });
  } catch { return json({ error: "Could not update garage prices" }, 500); }
});