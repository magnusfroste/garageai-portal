// Operator/admin "Offer" toggle per garage model: on -> acceptance test -> live; off -> paused and removed from LiteLLM.
import { corsHeaders, json, NAME_RE, getCaller } from "../_shared/garageAuth.ts";
import { GARAGE_SELECT, withProbeDeployments, type RoutingGarage } from "../_shared/garageRouting.ts";
import { isEmbeddingModel } from "../_shared/garageModels.ts";
import { runAndStoreAcceptanceTests, toPublicResult } from "../_shared/acceptanceTest.ts";
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
    const model = typeof body.model === "string" ? body.model : "";
    if (!NAME_RE.test(name) || !model || model.length > 128 || typeof body.offered !== "boolean") return json({ error: "name, model and offered (boolean) are required" }, 400);
    const offered = body.offered;
    const { data: garage } = await admin.from("garages").select(GARAGE_SELECT).eq("name", name).maybeSingle();
    if (!garage || (!isAdmin && garage.operator_id !== userId)) return json({ error: "Garage not found" }, 404);
    if (garage.connection_type === "endpoint" && !isAdmin) return json({ error: "Models on provider endpoints are offered by GarageAI admins." }, 403);
    if (offered && isEmbeddingModel(model)) return json({ error: "Embedding models are not supported yet" }, 400);
    const { data: row } = await admin.from("garage_models").select("installed").eq("garage_id", garage.id).eq("model", model).maybeSingle();
    if (!row) return json({ error: "Model not found on this garage" }, 404);
    if (offered && !row.installed) return json({ error: "The model is no longer installed on the machine" }, 400);

    await admin.from("garage_models").update({ offered, status: offered ? "testing" : "paused", updated_at: new Date().toISOString() }).eq("garage_id", garage.id).eq("model", model);
    let acceptance: unknown[] = [];
    if (offered && !garage.disabled) {
      const results = await withProbeDeployments(admin, garage as RoutingGarage, [model], (base, key, routeFor) => runAndStoreAcceptanceTests(admin, base, key, garage, [model], routeFor));
      if (results[0]?.inconclusive) await admin.from("garage_models").update({ status: "untested" }).eq("garage_id", garage.id).eq("model", model);
      if (results.some((r) => r.passed) && garage.status !== "online") await admin.from("garages").update({ status: "online" }).eq("id", garage.id);
      acceptance = results.map(toPublicResult);
      await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true, testResults: { garage: garage.name, results: new Map(results.filter((r) => !r.inconclusive).map((r) => [r.model, r.passed])) } });
    } else {
      await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true });
    }
    return json({ ok: true, offered, acceptance });
  } catch (e) {
    console.error("[set-model-offered] error", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
