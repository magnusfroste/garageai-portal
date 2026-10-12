import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { newestBridgeRelease } from "../_shared/bridgeVersions.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Service unavailable" }, 503);
  const admin = createClient(url, key);
  const secret = req.headers.get("x-cron-secret");
  if (!secret) return json({ error: "Unauthorized" }, 401);
  const { data: ok, error: authError } = await admin.rpc("verify_cron_secret", { secret });
  if (authError || ok !== true) return json({ error: "Unauthorized" }, 401);
  try {
    const releases = [];
    for (let page = 1; page <= 10; page++) {
      const response = await fetch(`https://api.github.com/repos/magnusfroste/garageai/releases?per_page=100&page=${page}`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "GarageAI-Portal" }, signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`GitHub release check failed (${response.status})`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error("Invalid release response");
      releases.push(...rows);
      if (rows.length < 100) break;
    }
    const release = newestBridgeRelease(releases);
    if (!release?.version) return json({ error: "No Bridge release found" }, 404);
    const checked_at = new Date().toISOString();
    const { error } = await admin.rpc("record_bridge_release", { p_version: release.version, p_tag: release.tag, p_checked_at: checked_at });
    if (error) throw error;
    return json({ ...release, checked_at });
  } catch (e) {
    console.error("[check-bridge-release]", e instanceof Error ? e.message : "Unknown error");
    return json({ error: e instanceof Error ? e.message : "Release check failed" }, 502);
  }
});