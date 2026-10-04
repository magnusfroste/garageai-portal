import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { syncModels } from "../_shared/syncModels.ts";

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

    const result = await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true });
    return json(result);
  } catch (e) {
    console.error("[sync-models-cron] error:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
