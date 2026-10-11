// Bridge device-link poll. Credentials are returned exactly once. Never logs device codes, tokens or setup keys.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decidePoll, type LinkRow } from "../_shared/bridgeLink.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const sha256Hex = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), (x) => x.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const code = typeof body?.device_code === "string" ? body.device_code.trim() : "";
    if (!/^gbd_[0-9a-f]{64}$/.test(code)) return json({ status: "unknown" }, 404);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: row, error } = await admin.from("bridge_links").select("id, status, expires_at, last_poll_at, credentials, garage_id, garages(id, name)").eq("device_code_hash", await sha256Hex(code)).maybeSingle();
    if (error) throw error;
    if (!row) return json({ status: "unknown" }, 404);
    const g = (row as any).garages as { id: string; name: string } | null;
    const decision = decidePoll({ ...(row as any), garage: g } as LinkRow, Date.now());
    if (decision.pickup) {
      // Conditional update: only the first poll that flips approved → picked_up gets the credentials.
      const { data: flipped } = await admin.from("bridge_links").update(decision.patch).eq("id", row.id).eq("status", "approved").select("id");
      if (!flipped?.length) return json({ status: "picked_up" });
      console.log("[bridge-link-poll] picked up", { garage: g?.name });
      return json(decision.body);
    }
    if (Object.keys(decision.patch).length) await admin.from("bridge_links").update(decision.patch).eq("id", row.id);
    return json(decision.body);
  } catch (e) {
    console.error("[bridge-link-poll] error", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
