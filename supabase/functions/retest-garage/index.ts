import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";
import { syncModels } from "../_shared/syncModels.ts";
import { runAndStoreAcceptanceTests, toPublicResult } from "../_shared/acceptanceTest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MASTER_KEY = Deno.env.get("LITELLM_MASTER_KEY");
    if (!MASTER_KEY) return json({ error: "Server not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabaseAnon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "");
    const { data: { user } } = await supabaseAnon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!NAME_RE.test(name)) return json({ error: "name must match ^[a-z0-9][a-z0-9-]{1,40}$" }, 400);

    const { data: garage, error: gErr } = await admin.from("garages").select("id, name, models").eq("name", name).maybeSingle();
    if (gErr) throw gErr;
    if (!garage) return json({ error: "Garage not found" }, 404);
    const models = (garage.models || []) as string[];
    if (models.length === 0) return json({ error: "Garage has no registered models" }, 400);

    const litellm = await getProxyBaseUrl(admin);
    const acceptance = await runAndStoreAcceptanceTests(admin, litellm, MASTER_KEY, garage, models);
    const anyPassed = acceptance.some((r) => r.passed);
    const status = anyPassed ? "online" : "failed_test";
    await admin.from("garages").update({ status }).eq("id", garage.id);

    let catalogSynced = true;
    try {
      await syncModels(admin, {
        checkNonGarageHealth: false,
        enableNewGarageModels: true,
        testResults: { garage: garage.name, results: new Map(acceptance.map((r) => [r.model, r.passed])) },
      });
    } catch (e) {
      catalogSynced = false;
      console.error("[retest-garage] catalog sync failed:", e instanceof Error ? e.message : "unknown");
    }

    return json({ ok: true, garage: garage.name, status, catalog_synced: catalogSynced, acceptance: acceptance.map(toPublicResult) });
  } catch (e) {
    console.error("[retest-garage] error:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
