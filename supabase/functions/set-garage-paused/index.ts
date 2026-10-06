// Operator pause/resume for a whole garage or one model. Pause = removed from LiteLLM now (like un-offer);
// resume = re-registered from the stored runtime key and offered models, without re-running acceptance tests.
import { corsHeaders, json, NAME_RE, getCaller } from "../_shared/garageAuth.ts";
import { syncModels } from "../_shared/syncModels.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const caller = await getCaller(req);
    if (caller instanceof Response) return caller;
    const { admin, userId, isAdmin } = caller;
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const name = typeof body.name === "string" ? body.name : "";
    const model = typeof body.model === "string" && body.model ? body.model : null;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) || null : null;
    if (!NAME_RE.test(name) || typeof body.paused !== "boolean" || (model && model.length > 128)) return json({ error: "name and paused (boolean) are required" }, 400);
    const paused = body.paused;
    const { data: garage } = await admin.from("garages").select("id, operator_id").eq("name", name).maybeSingle();
    if (!garage || (!isAdmin && garage.operator_id !== userId)) return json({ error: "Garage not found" }, 404);
    const at = paused ? new Date().toISOString() : null;
    if (model) {
      const { data: row } = await admin.from("garage_models").update({ paused_at: at, updated_at: new Date().toISOString() })
        .eq("garage_id", garage.id).eq("model", model).select("model").maybeSingle();
      if (!row) return json({ error: "Model not found on this garage" }, 404);
    } else {
      await admin.from("garages").update({ paused_at: at, paused_reason: paused ? reason : null }).eq("id", garage.id);
    }
    let routing_synced = true;
    try { await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true }); }
    catch (e) { routing_synced = false; console.error("[set-garage-paused] sync failed", e instanceof Error ? e.message : "unknown"); }
    return json({ ok: true, paused, model, routing_synced });
  } catch (e) {
    console.error("[set-garage-paused] error", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
