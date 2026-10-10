import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registerGarage, validateGaragePayload } from "../_shared/registerGarage.ts";
import { syncModels } from "../_shared/syncModels.ts";
import { toPublicResult } from "../_shared/acceptanceTest.ts";
import { changedContexts } from "../_shared/garageModels.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
async function sha256Hex(value: string) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, "0")).join(""); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ") || !auth.slice(7).trim()) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: token } = await admin.from("garage_tokens").select("garage_id").eq("token_hash", await sha256Hex(auth.slice(7).trim())).is("revoked_at", null).maybeSingle();
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: garage } = await admin.from("garages").select("*").eq("id", token.garage_id).maybeSingle();
    if (!garage) return json({ error: "Unauthorized" }, 401);
    if (garage.disabled) return json({ error: "garage disabled by platform" }, 403);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    if (body.name !== garage.name) return json({ error: "name does not match the garage for this token" }, 400);
    let payload;
    try { payload = validateGaragePayload(body, true); } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid body" }, 400); }
    const now = new Date().toISOString();
    await admin.from("garages").update({ last_heartbeat_at: now }).eq("id", garage.id);
    const previous = new Set<string>((garage.models || []) as string[]);
    const current = new Set(payload.models);
    const added = payload.models.filter((model) => !previous.has(model));
    const removed = [...previous].filter((model) => !current.has(model));
    const contextChanges = await changedContexts(admin, garage.id, payload.contexts ?? {});
    const contextChanged = Object.keys(contextChanges).some((m) => previous.has(m));
    const changed = added.length > 0 || removed.length > 0 || garage.runtime !== payload.runtime || garage.port !== payload.port || contextChanged;

    if (!changed) {
      if (garage.status === "offline") {
        const { data: tests } = await admin.from("garage_model_tests").select("model, passed, tested_at").eq("garage_id", garage.id).eq("inconclusive", false).order("tested_at", { ascending: false });
        const latest = new Map<string, boolean>();
        for (const test of (tests || []) as Array<{ model: string; passed: boolean }>) if (!latest.has(test.model)) latest.set(test.model, test.passed);
        if (payload.models.some((model) => latest.get(model) === true)) {
          await admin.from("garages").update({ status: "online" }).eq("id", garage.id);
          await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true });
        }
      }
      return json({ ok: true, changed: false });
    }

    const result = await registerGarage(admin, garage, payload, { testOnly: added });
    return json({ ok: true, changed: true, added, removed, contexts_changed: Object.keys(contextChanges), acceptance: result.acceptance.map(toPublicResult) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message.includes("connected to the mesh") || message.includes("connected to mesh")) return json({ error: message }, 409);
    console.error("[node-heartbeat] error", message);
    return json({ error: "Internal error" }, 500);
  }
});