// Bridge device-link start: the machine asks to be linked; the operator approves it in the browser. No auth.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { LINK_TTL_S, POLL_INTERVAL_S, STARTS_PER_IP_PER_HOUR, VERIFICATION_URL, makeDeviceCode, makeUserCode, parseStartBody } from "../_shared/bridgeLink.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sha256Hex = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), (x) => x.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    let body: unknown = {};
    const raw = await req.text();
    if (raw.trim()) { try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON body" }, 400); } }
    const parsed = parseStartBody(body);
    if (!parsed.fields) return json({ error: parsed.error }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
    const ipHash = await sha256Hex(`bridge-link:${ip}`); // raw IPs are never stored
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("bridge_links").select("id", { count: "exact", head: true }).eq("requested_ip_hash", ipHash).gte("created_at", since);
    if ((count ?? 0) >= STARTS_PER_IP_PER_HOUR) return json({ error: "Too many link requests, try again later" }, 429);

    const country = (req.headers.get("cf-ipcountry") || req.headers.get("x-country-code") || "").trim().toUpperCase();
    const deviceCode = makeDeviceCode();
    const now = Date.now();
    let userCode = "";
    for (let i = 0; i < 5; i++) {
      userCode = makeUserCode();
      const { error } = await admin.from("bridge_links").insert({
        device_code_hash: await sha256Hex(deviceCode), user_code: userCode, status: "pending", ...parsed.fields,
        requested_ip_country: /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : null, requested_ip_hash: ipHash,
        created_at: new Date(now).toISOString(), expires_at: new Date(now + LINK_TTL_S * 1000).toISOString(),
      });
      if (!error) break;
      if (error.code !== "23505" || i === 4) throw error;
    }
    // Housekeeping: drop links older than 30 days.
    await admin.from("bridge_links").delete().lt("created_at", new Date(now - 30 * 86400_000).toISOString());
    console.log("[bridge-link-start] started", { hostname: parsed.fields.hostname, bridge_version: parsed.fields.bridge_version });
    return json({
      device_code: deviceCode, user_code: userCode, verification_url: VERIFICATION_URL,
      verification_url_complete: `${VERIFICATION_URL}?code=${userCode}`, interval: POLL_INTERVAL_S, expires_in: LINK_TTL_S,
    });
  } catch (e) {
    console.error("[bridge-link-start] error", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
