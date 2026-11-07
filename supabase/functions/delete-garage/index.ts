// Permanently deletes a garage. Admins, or the owning operator. Every step is idempotent.
// Ledger tables (hourly stats, price history) are kept; they carry garage_name and no FK.
import { corsHeaders, json, getCaller } from "../_shared/garageAuth.ts";
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";
import { readGatewayDeployments } from '../_shared/gatewayDeployments.ts';
import { syncModels } from "../_shared/syncModels.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const caller = await getCaller(req);
    if (caller instanceof Response) return caller;
    const { admin } = caller;
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const garageId = typeof body.garage_id === "string" ? body.garage_id : "";
    if (!UUID_RE.test(garageId)) return json({ error: "garage_id must be a uuid" }, 400);

    const { data: garage, error } = await admin.from("garages").select("id, name, operator_id, connection_type").eq("id", garageId).maybeSingle();
    if (error) throw error;
    if (!garage) return json({ error: "Garage not found" }, 404);
    if (!caller.isAdmin && garage.operator_id !== caller.userId) return json({ error: "Forbidden" }, 403);
    const name = garage.name as string;

    // 2. LiteLLM deployments (same prefix path as disable/pause).
    let litellm_removed = 0;
    const MASTER_KEY = Deno.env.get("LITELLM_MASTER_KEY");
    if (MASTER_KEY) {
      const litellm = await getProxyBaseUrl(admin);
      const headers = { Authorization: `Bearer ${MASTER_KEY}`, "Content-Type": "application/json" };
      const deployments = await readGatewayDeployments<{ model_info?: { id?: string } }>(litellm, MASTER_KEY);
      for (const d of deployments) {
        const id = d.model_info?.id;
        if (id && id.startsWith(`${name}__`)) {
          const r = await fetch(`${litellm}/model/delete`, { method: "POST", headers, body: JSON.stringify({ id }) });
          await r.text();
          if (r.ok) litellm_removed++;
        }
      }
    }

    // Free the Bridge tunnel identity first; the hub drops the peer once the garage leaves gateway-targets.
    await admin.from("garages").update({ tunnel_public_key: null, tunnel_ip: null, tunnel_assigned_at: null }).eq("id", garageId);

    // 3. Credentials.
    const rows_deleted: Record<string, number> = {};
    const del = async (table: string, col: string, val: string) => {
      const { count, error: e } = await admin.from(table).delete({ count: "exact" }).eq(col, val);
      if (e) throw new Error(`${table}: ${e.message}`);
      rows_deleted[table] = count ?? 0;
    };
    await del("garage_tokens", "garage_id", garageId);
    await del("garage_runtime_secrets", "garage_id", garageId);

    // 4. Rows (ledger tables are intentionally kept).
    for (const t of ["garage_models", "garage_model_tests", "garage_model_failures", "garage_status_samples", "garage_country_history"]) await del(t, "garage_id", garageId);
    await del("curated_models", "garage", name);
    await del("garages", "id", garageId);

    try { await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: false }); }
    catch (e) { console.error("[delete-garage] sync failed:", e instanceof Error ? e.message : "unknown"); }

    console.log("[delete-garage] deleted", { garage: name, by_admin: caller.isAdmin, litellm_removed });
    return json({ ok: true, garage: name, litellm_removed, rows_deleted });
  } catch (e) {
    console.error("[delete-garage] error:", e instanceof Error ? e.message : "unknown");
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
