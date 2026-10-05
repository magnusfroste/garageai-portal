// Aggregates LiteLLM spend logs into garage_request_stats_hourly. Cron-only (x-cron-secret).
// The five-minute cron runs the same ingestion inside sync-models-cron; this endpoint allows a manual run.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ingestUsageStats } from "../_shared/reliability.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const secret = req.headers.get("x-cron-secret");
    if (!secret) return json({ error: "Unauthorized" }, 401);
    const { data: ok, error } = await admin.rpc("verify_cron_secret", { secret });
    if (error || ok !== true) return json({ error: "Unauthorized" }, 401);
    return json(await ingestUsageStats(admin));
  } catch (e) {
    console.error("[ingest-usage-stats] error:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
