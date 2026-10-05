import { corsHeaders, json, NAME_RE, getCaller } from "../_shared/garageAuth.ts";
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";
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
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!NAME_RE.test(name)) return json({ error: "name must match ^[a-z0-9][a-z0-9-]{1,40}$" }, 400);
    if (typeof body.disabled !== "boolean") return json({ error: "disabled must be a boolean" }, 400);
    const disabled = body.disabled;

    const { data: garage, error } = await admin.from("garages").select("id, name").eq("name", name).maybeSingle();
    if (error) throw error;
    if (!garage) return json({ error: "Garage not found" }, 404);

    if (!disabled) {
      const { error: uErr } = await admin.from("garages").update({ disabled: false, status: "pending" }).eq("id", garage.id);
      if (uErr) throw uErr;
      await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true });
      console.log("[set-garage-disabled] enabled", { garage: name });
      return json({ ok: true, garage: name, disabled: false, status: "pending" });
    }

    const { error: uErr } = await admin.from("garages").update({ disabled: true, status: "disabled" }).eq("id", garage.id);
    if (uErr) throw uErr;
    const { error: rErr } = await admin
      .from("garage_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("garage_id", garage.id)
      .is("revoked_at", null);
    if (rErr) throw rErr;

    let deployments_deleted = 0;
    const MASTER_KEY = Deno.env.get("LITELLM_MASTER_KEY");
    if (MASTER_KEY) {
      const litellm = await getProxyBaseUrl(admin);
      const headers = { Authorization: `Bearer ${MASTER_KEY}`, "Content-Type": "application/json" };
      const infoRes = await fetch(`${litellm}/model/info`, { headers });
      if (infoRes.ok) {
        const info = await infoRes.json();
        const prefix = `${name}__`;
        for (const d of (info?.data || []) as Array<{ model_info?: { id?: string } }>) {
          const id = d.model_info?.id;
          if (id && id.startsWith(prefix)) {
            const r = await fetch(`${litellm}/model/delete`, { method: "POST", headers, body: JSON.stringify({ id }) });
            await r.text();
            if (r.ok) deployments_deleted++;
          }
        }
      } else {
        await infoRes.text();
        console.warn("[set-garage-disabled] LiteLLM /model/info failed", { status: infoRes.status });
      }
    }

    let catalog_synced = true;
    try {
      await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: false });
    } catch (e) {
      catalog_synced = false;
      console.error("[set-garage-disabled] sync failed:", e instanceof Error ? e.message : "unknown");
    }

    console.log("[set-garage-disabled] disabled", { garage: name, deployments_deleted });
    return json({ ok: true, garage: name, disabled: true, status: "disabled", deployments_deleted, catalog_synced });
  } catch (e) {
    console.error("[set-garage-disabled] error:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
