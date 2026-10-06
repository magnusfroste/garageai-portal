// Gateway L1 (NetBird peer) / L2 (GET /v1/models) results -> garages columns -> routing within a minute.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { gatewayJson, isGatewayAuthorized } from "../_shared/gatewayAuth.ts";
import { GARAGE_SELECT, GATEWAY_TEST_MAX_AGE_MS, gatewayHealthy, withProbeDeployments, type RoutingGarage } from "../_shared/garageRouting.ts";
import { offeredByGarage } from "../_shared/garageModels.ts";
import { runAndStoreAcceptanceTests } from "../_shared/acceptanceTest.ts";
import { syncModels } from "../_shared/syncModels.ts";

const RETEST_COOLDOWN_MS = 10 * 60 * 1000;
interface Result { garage: string; checked_at?: string; mesh_connected?: boolean | null; runtime_ok?: boolean; runtime_error?: string | null; models?: string[] }

const parse = (body: unknown): Result[] | null => {
  const results = (body as { results?: unknown })?.results;
  if (!Array.isArray(results) || results.length > 500) return null;
  const out: Result[] = [];
  for (const r of results as Record<string, unknown>[]) {
    if (typeof r?.garage !== "string" || r.garage.length > 64) return null;
    const models = Array.isArray(r.models) ? (r.models as unknown[]).filter((m): m is string => typeof m === "string" && m.length <= 128).slice(0, 200) : [];
    const checked = typeof r.checked_at === "string" && !Number.isNaN(Date.parse(r.checked_at)) ? r.checked_at : new Date().toISOString();
    out.push({
      garage: r.garage, checked_at: checked,
      mesh_connected: typeof r.mesh_connected === "boolean" ? r.mesh_connected : null,
      runtime_ok: r.runtime_ok === true,
      runtime_error: typeof r.runtime_error === "string" ? r.runtime_error.slice(0, 500) : null,
      models,
    });
  }
  return out;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return gatewayJson({ error: "Method not allowed" }, 405);
  if (!(await isGatewayAuthorized(req))) return gatewayJson({ error: "Unauthorized" }, 401);
  let results: Result[] | null;
  try { results = parse(await req.json()); } catch { results = null; }
  if (!results) return gatewayJson({ error: "body must be { results: [{ garage, checked_at, mesh_connected, runtime_ok, runtime_error, models }] }" }, 400);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rows } = await admin.from("garages").select(GARAGE_SELECT).in("name", results.map((r) => r.garage)).eq("disabled", false);
    const byName = new Map(((rows || []) as RoutingGarage[]).map((g) => [g.name, g]));
    const offered = await offeredByGarage(admin, [...byName.values()].map((g) => g.id));
    let changed = false;
    const summary: Array<{ garage: string; healthy: boolean; changed: boolean; tested?: string[] }> = [];

    for (const r of results) {
      const g = byName.get(r.garage);
      if (!g) continue;
      const wasHealthy = !!g.last_gateway_check_at && gatewayHealthy(g);
      const next = { mesh_connected: r.mesh_connected, runtime_ok: r.runtime_ok === true };
      const healthy = gatewayHealthy(next);
      const flipped = !g.last_gateway_check_at || wasHealthy !== healthy;
      if (flipped) changed = true;

      const { data: tests } = await admin.from("garage_model_tests").select("model, passed, tested_at, inconclusive").eq("garage_id", g.id).order("tested_at", { ascending: false }).limit(200);
      const latest = new Map<string, { passed: boolean; at: number }>();
      let lastAny = 0;
      for (const t of (tests || []) as Array<{ model: string; passed: boolean; tested_at: string; inconclusive: boolean }>) {
        lastAny = Math.max(lastAny, Date.parse(t.tested_at));
        if (!t.inconclusive && !latest.has(t.model)) latest.set(t.model, { passed: t.passed, at: Date.parse(t.tested_at) });
      }
      const anyRecentPass = [...latest.values()].some((t) => t.passed && Date.now() - t.at <= GATEWAY_TEST_MAX_AGE_MS);
      const status = !healthy ? (g.status === "failed_test" ? "failed_test" : "offline") : anyRecentPass ? "online" : g.status === "offline" ? "pending" : g.status;
      if (status !== g.status) changed = true;
      await admin.from("garages").update({ last_gateway_check_at: r.checked_at, ...next, runtime_error: r.runtime_error, runtime_models: r.models, status }).eq("id", g.id);
      await admin.from("curated_models").update({ status: healthy ? "healthy" : "unhealthy" }).eq("garage", g.name);

      let tested: string[] | undefined;
      // A paused garage is measured but never relisted or retested here (routing also excludes paused_at).
      if (healthy && !g.paused_at) {
        const off = offered.get(g.id);
        const models = (g.models || []).filter((m) => !off || off.has(m));
        const stale = models.filter((m) => { const t = latest.get(m); return !t || Date.now() - t.at > GATEWAY_TEST_MAX_AGE_MS; });
        if (stale.length && Date.now() - lastAny > RETEST_COOLDOWN_MS) {
          const fresh = { ...g, ...next, last_gateway_check_at: r.checked_at } as RoutingGarage;
          try {
            await withProbeDeployments(admin, fresh, stale, (base, key, routeFor) => runAndStoreAcceptanceTests(admin, base, key, g, stale, routeFor));
            tested = stale; changed = true;
          } catch (e) { console.error("[gateway-health] acceptance failed", e instanceof Error ? e.message : "unknown"); }
        }
      }
      summary.push({ garage: g.name, healthy, changed: flipped, tested });
    }

    let synced = false;
    if (changed) {
      try { await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true }); synced = true; }
      catch (e) { console.error("[gateway-health] sync failed", e instanceof Error ? e.message : "unknown"); }
    }
    return gatewayJson({ ok: true, synced, results: summary });
  } catch (e) {
    console.error("[gateway-health] error", e instanceof Error ? e.message : "unknown");
    return gatewayJson({ error: "Internal error" }, 500);
  }
});
