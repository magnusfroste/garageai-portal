import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Daily: revoke chat keys with no customer traffic for 30 days (stale_chat_keys).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const secret = req.headers.get("x-cron-secret");
  if (!secret) return json({ error: "Unauthorized" }, 401);
  const ok = await admin.rpc("verify_cron_secret", { secret });
  if (ok.error || ok.data !== true) return json({ error: "Unauthorized" }, 401);
  const master = Deno.env.get("LITELLM_MASTER_KEY") ?? "";
  const { data: stale, error } = await admin.rpc("stale_chat_keys", { _days: 30 });
  if (error) return json({ error: "query_failed" }, 500);
  const base = await getProxyBaseUrl(admin);
  let revoked = 0;
  for (const k of (stale ?? []) as Array<{ id: string; litellm_token: string | null }>) {
    if (k.litellm_token) {
      const res = await fetch(`${base}/key/delete`, { method: "POST", headers: { Authorization: `Bearer ${master}`, "Content-Type": "application/json" }, body: JSON.stringify({ keys: [k.litellm_token] }) });
      await res.text().catch(() => "");
      // 404 = already gone in the gateway; anything else: try again tomorrow.
      if (!res.ok && res.status !== 404) continue;
    }
    const { error: upd } = await admin.from("api_keys").update({ is_active: false, revoked_at: new Date().toISOString() }).eq("id", k.id);
    if (!upd) revoked++;
  }
  return json({ checked: stale?.length ?? 0, revoked });
});
