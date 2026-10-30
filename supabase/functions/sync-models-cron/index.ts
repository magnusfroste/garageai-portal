import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { syncModels } from "../_shared/syncModels.ts";
import { ingestUsageStats, recordStatusSamples, runHourlyProbes } from "../_shared/reliability.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const safe = async <T>(label: string, fn: () => Promise<T>) => {
  try { return await fn(); } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error(`[sync-models-cron] ${label} failed:`, msg);
    return { error: msg };
  }
};

const background = (work: Promise<unknown>) => {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (rt) rt.waitUntil(work); else work.catch(() => {});
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const secret = req.headers.get("x-cron-secret");
    if (!secret) return json({ error: "Unauthorized" }, 401);
    const { data: ok, error } = await admin.rpc("verify_cron_secret", { secret });
    if (error || ok !== true) return json({ error: "Unauthorized" }, 401);

    // pg_net waits only 5 s: acknowledge now, do the work in the background.
    background((async () => {
      try {
        const result = await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true });
        await safe("samples", () => recordStatusSamples(admin, result));
        await safe("usage", () => ingestUsageStats(admin));
        await safe("probes", () => runHourlyProbes(admin));
      } catch (e) {
        console.error("[sync-models-cron] background error:", e instanceof Error ? e.message : "unknown");
      }
    })());
    return json({ accepted: true }, 202);
  } catch (e) {
    console.error("[sync-models-cron] error:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
