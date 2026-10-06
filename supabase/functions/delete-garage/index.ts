// Permanently deletes a garage. Admins, or the owning operator. Every step is idempotent.
// Ledger tables (hourly stats, price history) are kept; they carry garage_name and no FK.
import { corsHeaders, json, getCaller } from "../_shared/garageAuth.ts";
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";
import { syncModels } from "../_shared/syncModels.ts";
import { getNetbirdApiUrl, netbirdHeaders } from "../_shared/netbirdConfig.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function nbDelete(url: string): Promise<boolean> {
  const r = await fetch(url, { method: "DELETE", headers: netbirdHeaders() });
  await r.text();
  if (r.ok) return true;
  if (r.status === 404) return false;
  throw new Error(`NetBird DELETE failed with status ${r.status}`);
}

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

    const { data: garage, error } = await admin.from("garages").select("id, name, operator_id, connection_type, netbird_peer_id").eq("id", garageId).maybeSingle();
    if (error) throw error;
    if (!garage) return json({ error: "Garage not found" }, 404);
    if (!caller.isAdmin && garage.operator_id !== caller.userId) return json({ error: "Forbidden" }, 403);
    const name = garage.name as string;

    // 1. LiteLLM deployments (same prefix path as disable/pause).
    let litellm_removed = 0;
    const MASTER_KEY = Deno.env.get("LITELLM_MASTER_KEY");
    if (MASTER_KEY) {
      const litellm = await getProxyBaseUrl(admin);
      const headers = { Authorization: `Bearer ${MASTER_KEY}`, "Content-Type": "application/json" };
      const infoRes = await fetch(`${litellm}/model/info`, { headers });
      if (!infoRes.ok) { await infoRes.text(); throw new Error(`LiteLLM /model/info failed with status ${infoRes.status}`); }
      const info = await infoRes.json();
      for (const d of (info?.data || []) as Array<{ model_info?: { id?: string } }>) {
        const id = d.model_info?.id;
        if (id && id.startsWith(`${name}__`)) {
          const r = await fetch(`${litellm}/model/delete`, { method: "POST", headers, body: JSON.stringify({ id }) });
          await r.text();
          if (r.ok) litellm_removed++;
        }
      }
    }

    // 2. Credentials.
    const rows_deleted: Record<string, number> = {};
    const del = async (table: string, col: string, val: string) => {
      const { count, error: e } = await admin.from(table).delete({ count: "exact" }).eq(col, val);
      if (e) throw new Error(`${table}: ${e.message}`);
      rows_deleted[table] = count ?? 0;
    };
    await del("garage_tokens", "garage_id", garageId);
    await del("garage_runtime_secrets", "garage_id", garageId);

    // 3. NetBird (mesh only).
    let netbird_peer_deleted = false, netbird_group_deleted = false, netbird_setup_keys_deleted = 0;
    if (garage.connection_type !== "endpoint") {
      const api = await getNetbirdApiUrl(admin);
      if (garage.netbird_peer_id) netbird_peer_deleted = await nbDelete(`${api}/peers/${encodeURIComponent(garage.netbird_peer_id)}`);
      const gRes = await fetch(`${api}/groups`, { headers: netbirdHeaders() });
      if (!gRes.ok) { await gRes.text(); throw new Error(`NetBird GET /groups failed with status ${gRes.status}`); }
      const group = ((await gRes.json()) as Array<{ id: string; name: string }>).find((g) => g.name === `garage-${name}`);
      if (group) {
        const kRes = await fetch(`${api}/setup-keys`, { headers: netbirdHeaders() });
        if (!kRes.ok) { await kRes.text(); throw new Error(`NetBird GET /setup-keys failed with status ${kRes.status}`); }
        for (const k of (await kRes.json()) as Array<{ id: string; auto_groups?: string[] }>) {
          if ((k.auto_groups || []).includes(group.id) && await nbDelete(`${api}/setup-keys/${encodeURIComponent(k.id)}`)) netbird_setup_keys_deleted++;
        }
        netbird_group_deleted = await nbDelete(`${api}/groups/${encodeURIComponent(group.id)}`);
      }
    }

    // 4. Rows (ledger tables are intentionally kept).
    for (const t of ["garage_models", "garage_model_tests", "garage_model_failures", "garage_status_samples", "garage_country_history"]) await del(t, "garage_id", garageId);
    await del("curated_models", "garage", name);
    await del("garages", "id", garageId);

    try { await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: false }); }
    catch (e) { console.error("[delete-garage] sync failed:", e instanceof Error ? e.message : "unknown"); }

    console.log("[delete-garage] deleted", { garage: name, by_admin: caller.isAdmin, litellm_removed });
    return json({ ok: true, garage: name, litellm_removed, netbird_peer_deleted, netbird_group_deleted, netbird_setup_keys_deleted, rows_deleted });
  } catch (e) {
    console.error("[delete-garage] error:", e instanceof Error ? e.message : "unknown");
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
