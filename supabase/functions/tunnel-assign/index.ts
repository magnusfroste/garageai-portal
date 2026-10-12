// Assigns a Bridge tunnel address (or releases back to NetBird). Auth: the garage's register token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { lowestFreeTunnelIp, validTunnelKey, type TunnelHub } from "../_shared/tunnel.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
async function sha256Hex(value: string) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join(""); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ") || !auth.slice(7).trim()) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: token } = await admin.from("garage_tokens").select("garage_id").eq("token_hash", await sha256Hex(auth.slice(7).trim())).is("revoked_at", null).maybeSingle();
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: garage } = await admin.from("garages").select("id, name, disabled, connection_type, tunnel_ip, tunnel_public_key").eq("id", token.garage_id).maybeSingle();
    if (!garage) return json({ error: "Unauthorized" }, 401);
    if (garage.disabled) return json({ error: "garage disabled by platform" }, 403);
    if (garage.connection_type === "endpoint") return json({ error: "provider endpoints have no tunnel" }, 400);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

    if (body.release === true) {
      const { error } = await admin.from("garages").update({ transport: "netbird", tunnel_public_key: null }).eq("id", garage.id);
      if (error) throw error;
      await admin.from("onboarding_events").insert({ garage_id: garage.id, step: "tunnel", status: "done", message: "Back on NetBird" });
      return json({ ok: true });
    }

    const key = body.tunnel_public_key;
    if (!validTunnelKey(key)) return json({ error: "tunnel_public_key must be base64 decoding to 32 bytes", code: "invalid_key" }, 400);
    const { data: other } = await admin.from("garages").select("id").eq("tunnel_public_key", key).neq("id", garage.id).maybeSingle();
    if (other) return json({ error: "tunnel_public_key is used by another garage", code: "key_in_use" }, 409);

    const { data: hubRow } = await admin.from("admin_settings").select("value").eq("key", "tunnel_hub").maybeSingle();
    const hub = hubRow?.value as TunnelHub | undefined;
    if (!hub?.public_key) return json({ error: "Tunnel hub not configured" }, 503);

    let ip = garage.tunnel_ip as string | null;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!ip) {
        const { data: used } = await admin.from("garages").select("tunnel_ip").not("tunnel_ip", "is", null);
        ip = lowestFreeTunnelIp(((used || []) as Array<{ tunnel_ip: string }>).map((r) => r.tunnel_ip));
        if (!ip) return json({ error: "No free tunnel addresses" }, 503);
      }
      const { error } = await admin.from("garages").update({ tunnel_ip: ip, tunnel_public_key: key, transport: "tunnel", tunnel_assigned_at: new Date().toISOString() }).eq("id", garage.id);
      if (!error) break;
      if (error.code !== "23505" || garage.tunnel_ip) throw error;
      ip = null; // lost a race for that address: pick again
      if (attempt === 4) throw error;
    }
    await admin.from("onboarding_events").insert({ garage_id: garage.id, step: "tunnel", status: "done", message: `Tunnel address ${ip} assigned` });
    return json({ tunnel_ip: ip, hub_public_key: hub.public_key, hub_endpoint: hub.endpoint, hub_ip: hub.hub_ip });
  } catch (e) {
    console.error("[tunnel-assign] error", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
