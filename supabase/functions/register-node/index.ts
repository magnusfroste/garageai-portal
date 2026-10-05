import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registerGarage, validateGaragePayload } from "../_shared/registerGarage.ts";
import { toPublicResult } from "../_shared/acceptanceTest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Authenticate register token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7).trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const tokenHash = await sha256Hex(token);
    const { data: tokRow } = await admin
      .from("garage_tokens")
      .select("garage_id")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();
    if (!tokRow) return json({ error: "Unauthorized" }, 401);

    const { data: garage } = await admin.from("garages").select("*").eq("id", tokRow.garage_id).maybeSingle();
    if (!garage) return json({ error: "Unauthorized" }, 401);
    if (garage.disabled) return json({ error: "garage disabled by platform" }, 403);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

    if (body.name !== garage.name) return json({ error: "name does not match the garage for this token" }, 400);

    let payload;
    try { payload = validateGaragePayload(body); } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid body" }, 400); }
    const result = await registerGarage(admin, garage, payload);
    console.log("[register-node] registered", { garage: garage.name, models: result.models.length, catalog_synced: result.catalog_synced });
    return json({ ok: true, garage: garage.name, api_base: result.api_base, models: result.models, catalog_synced: result.catalog_synced, acceptance: result.acceptance.map(toPublicResult) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    if (message.includes("connected to the mesh") || message.includes("connected to mesh")) return json({ error: message }, 409);
    console.error("[register-node] error:", message);
    return json({ error: "Internal error" }, 500);
  }
});
