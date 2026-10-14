import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { gatewayJson, isGatewayAuthorized } from "../_shared/gatewayAuth.ts";
import { handleOps, parseOpsBody, OPS_BY, type OpsStore } from "../_shared/managedModelsOps.ts";

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

Deno.serve(async (req) => {
  if (req.method !== "POST") return gatewayJson({ error: "Method not allowed" }, 405);
  if (!(await isGatewayAuthorized(req))) return gatewayJson({ error: "Unauthorized" }, 401);
  let raw: unknown;
  try { raw = await req.json(); } catch { return gatewayJson({ error: "invalid JSON" }, 400); }
  const body = parseOpsBody(raw);
  if (typeof body === "string") return gatewayJson({ error: body }, 400);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const store: OpsStore = {
    async garage(name) { const { data } = await db.from("garages").select("id, name, operator_id").eq("name", name).maybeSingle(); return data; },
    async isAdmin(uid) { const { data } = await db.rpc("has_role", { _user_id: uid, _role: "admin" }); return data === true; },
    async want(id, model, action) { const { error } = await db.rpc("apply_managed_model_request", { _garage_id: id, _model: model, _action: action, _by: OPS_BY }); fail(error); },
    async cancel(id, model) { const { error } = await db.rpc("apply_managed_model_cancel", { _garage_id: id, _model: model }); fail(error); },
    async managedRows(id, model) {
      let q = db.from("garage_managed_models").select("model, action, by, status, completed_mb, total_mb, error, requested_at, reported_at").eq("garage_id", id);
      if (model) q = q.eq("model", model);
      const { data, error } = await q.order("model"); fail(error); return data ?? [];
    },
    async inventory(id) { const { data, error } = await db.from("garage_models").select("model, installed, offered, status").eq("garage_id", id); fail(error); return data ?? []; },
    async latestTests(id) {
      const { data, error } = await db.from("garage_model_tests").select("model, passed, tested_at").eq("garage_id", id).or("inconclusive.is.null,inconclusive.eq.false").order("tested_at", { ascending: false }).limit(500);
      fail(error); return data ?? [];
    },
  };
  try {
    const r = await handleOps(store, body);
    return gatewayJson(r.body, r.status);
  } catch (e) {
    console.error("[managed-models-ops] error", e instanceof Error ? e.message : "unknown");
    return gatewayJson({ error: "Internal error" }, 500);
  }
});
