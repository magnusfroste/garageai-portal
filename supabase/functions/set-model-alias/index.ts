// Admin-only: alias an endpoint provider's runtime id to a canonical catalogue model (or mark it provider-private).
// Mesh garages are always auto-normalised; the database trigger enforces the same rule.
import { corsHeaders, json, NAME_RE, getCaller } from "../_shared/garageAuth.ts";
import { modelIdError } from "../_shared/garageRouting.ts";
import { normaliseModelId } from "../_shared/modelIdentity.ts";
import { syncModels } from "../_shared/syncModels.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const caller = await getCaller(req);
    if (caller instanceof Response) return caller;
    if (!caller.isAdmin) return json({ error: "Forbidden" }, 403);
    const { admin } = caller;
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const name = typeof body.name === "string" ? body.name : "";
    const model = typeof body.model === "string" ? body.model : "";
    const rawAlias = typeof body.canonical === "string" ? body.canonical.trim() : "";
    const isPrivate = body.private === true;
    if (!NAME_RE.test(name) || !model || model.length > 128) return json({ error: "name and model are required" }, 400);
    if (body.private !== undefined && typeof body.private !== "boolean") return json({ error: "private must be a boolean" }, 400);
    const canonical = rawAlias ? rawAlias.toLowerCase() : "";
    if (canonical) {
      const err = modelIdError(canonical);
      if (err) return json({ error: err }, 400);
    }
    const { data: garage } = await admin.from("garages").select("id, connection_type").eq("name", name).maybeSingle();
    if (!garage) return json({ error: "Garage not found" }, 404);
    if (garage.connection_type !== "endpoint") return json({ error: "Aliases are only allowed for endpoint providers" }, 400);
    const { data: row } = await admin.from("garage_models").select("model").eq("garage_id", garage.id).eq("model", model).maybeSingle();
    if (!row) return json({ error: "Model not found on this provider" }, 404);

    const update = canonical
      ? { canonical_model: canonical, canonical_source: "admin", private: isPrivate }
      : { canonical_model: normaliseModelId(model), canonical_source: "auto", private: isPrivate };
    const { error } = await admin.from("garage_models").update({ ...update, updated_at: new Date().toISOString() }).eq("garage_id", garage.id).eq("model", model);
    if (error) throw error;
    // Re-register routes under the new name; status and test results are kept (no new acceptance test).
    await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true });
    console.log("[set-model-alias]", { garage: name, source: update.canonical_source, private: isPrivate });
    return json({ ok: true, canonical_model: update.canonical_model, canonical_source: update.canonical_source, private: isPrivate });
  } catch (e) {
    console.error("[set-model-alias] error", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
