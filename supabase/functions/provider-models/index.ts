// Admin-only model checklist for endpoint providers: list the endpoint's models, offer (tick) or un-offer (untick) one.
import { corsHeaders, json, NAME_RE, getCaller } from "../_shared/garageAuth.ts";
import { GARAGE_SELECT, withProbeDeployments, type RoutingGarage } from "../_shared/garageRouting.ts";
import { modelIdError } from "../_shared/modelValidation.ts";
import { isEmbeddingModel } from "../_shared/garageModels.ts";
import { runAndStoreAcceptanceTests, toPublicResult } from "../_shared/acceptanceTest.ts";
import { syncModels } from "../_shared/syncModels.ts";
import { parseProviderModels } from "../_shared/providerModelList.ts";

const bad = (msg: string) => json({ error: msg }, 400);
const price = (v: unknown): number | null | "bad" => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? n : "bad";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const caller = await getCaller(req);
    if (caller instanceof Response) return caller;
    if (!caller.isAdmin) return json({ error: "Forbidden" }, 403);
    const { admin } = caller;
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return bad("Invalid JSON body"); }
    const name = typeof body.name === "string" ? body.name : "";
    if (!NAME_RE.test(name)) return bad("name is required");
    const { data: garage } = await admin.from("garages").select(GARAGE_SELECT).eq("name", name).maybeSingle();
    if (!garage || garage.connection_type !== "endpoint" || !garage.endpoint_url) return json({ error: "Provider not found" }, 404);
    const action = body.action;

    if (action === "list") {
      const { data: secret } = await admin.from("garage_runtime_secrets").select("runtime_api_key").eq("garage_id", garage.id).maybeSingle();
      const key = secret?.runtime_api_key as string | null | undefined;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      try {
        const res = await fetch(`${garage.endpoint_url}/models`, { redirect: "manual", signal: ctrl.signal, headers: key ? { Authorization: `Bearer ${key}`, "x-api-key": key, "anthropic-version": "2023-06-01" } : {} });
        if (res.status >= 300 && res.status < 400) { await res.body?.cancel(); return bad("Endpoint redirected; redirects are not followed"); }
        if (!res.ok) { await res.body?.cancel(); return bad(`Endpoint returned HTTP ${res.status} for /models`); }
        return json({ models: parseProviderModels(await res.json().catch(() => null)) });
      } catch (e) {
        return bad(e instanceof DOMException && e.name === "AbortError" ? "Endpoint timed out after 10 s" : "Could not reach endpoint");
      } finally { clearTimeout(timer); }
    }

    const model = typeof body.model === "string" ? body.model.trim() : "";
    const idErr = model ? modelIdError(model, true) : "model is required";
    if (idErr) return bad(idErr);
    const listed: string[] = garage.models || [];

    if (action === "offer") {
      if (isEmbeddingModel(model)) return bad("Embedding models are not supported yet");
      const input = price(body.input), output = price(body.output), cache = price(body.cache_read);
      if (input === "bad" || output === "bad" || cache === "bad") return bad("Prices must be numbers between 0 and 1000");
      if (cache !== null && input !== null && cache > input) return bad("The cache-read price may not exceed the input price");
      const ctx = body.context === undefined || body.context === null || body.context === "" ? null : Number(body.context);
      if (ctx !== null && (!Number.isInteger(ctx) || ctx < 1 || ctx > 100_000_000)) return bad("Context must be a positive whole number");
      const { error } = await admin.from("garage_models").upsert({
        garage_id: garage.id, model, installed: true, offered: true, status: "live", canonical_model: model, canonical_source: "admin",
        pool_input_cost_per_million: input, dedicated_input_cost_per_million: input,
        pool_output_cost_per_million: output, dedicated_output_cost_per_million: output,
        pool_cache_read_cost_per_million: cache, dedicated_cache_read_cost_per_million: cache,
        context_length: ctx, missing_heartbeats: 0, paused_at: null, updated_at: new Date().toISOString(),
      }, { onConflict: "garage_id,model" });
      if (error) throw error;
      const models = listed.includes(model) ? listed : [...listed, model];
      if (models !== listed) { const { error: e2 } = await admin.from("garages").update({ models }).eq("id", garage.id); if (e2) throw e2; }
      const g = { ...garage, models } as RoutingGarage;
      let acceptance: unknown[] = [];
      if (!garage.disabled) {
        const results = await withProbeDeployments(admin, g, [model], (base, key, routeFor) => runAndStoreAcceptanceTests(admin, base, key, garage, [model], routeFor));
        if (results[0]?.inconclusive) await admin.from("garage_models").update({ status: "untested" }).eq("garage_id", garage.id).eq("model", model);
        acceptance = results.map(toPublicResult);
        await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true, testResults: { garage: garage.name, results: new Map(results.filter((r) => !r.inconclusive).map((r) => [r.model, r.passed])) } });
      } else await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true });
      return json({ ok: true, offered: true, acceptance });
    }

    if (action === "unoffer") {
      // Same un-offer as set-model-offered; the row and its test history stay.
      await admin.from("garage_models").update({ offered: false, status: "paused", updated_at: new Date().toISOString() }).eq("garage_id", garage.id).eq("model", model);
      if (listed.includes(model)) await admin.from("garages").update({ models: listed.filter((m) => m !== model) }).eq("id", garage.id);
      await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true });
      return json({ ok: true, offered: false });
    }
    return bad("action must be list, offer or unoffer");
  } catch (e) {
    console.error("[provider-models] error", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
