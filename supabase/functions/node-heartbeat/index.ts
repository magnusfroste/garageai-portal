import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registerGarage, validateGaragePayload } from "../_shared/registerGarage.ts";
import { syncModels } from "../_shared/syncModels.ts";
import { toPublicResult } from "../_shared/acceptanceTest.ts";
import { changedContexts, applyInventoryMisses } from "../_shared/garageModels.ts";
import { parseAgent } from "../_shared/agentReport.ts";
import { parseAgentState, parseAgentNodes, nextAgentState, lifecycleTransition, splitReturnModels, resumeClearsPortalPause, type AgentState } from "../_shared/agentState.ts";
import { heartbeatBridgeFields, parseBridgeUpdate, updateErrorVersion } from "../_shared/bridgeUpdate.ts";
import { parseAgentModels, applyReports, pendingOffers, wantedModels, type ManagedRow, type WantedModel } from "../_shared/managedModels.ts";
import { parseMachineId, claimMachineId } from "../_shared/bridgeLink.ts";
import { reconcilePrivateGarage, storeRuntimeKey, GARAGE_SELECT, withProbeDeployments, type RoutingGarage } from '../_shared/garageRouting.ts';
import { runAndStoreAcceptanceTests } from '../_shared/acceptanceTest.ts';

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
    const { data: updateRow } = await admin.from("admin_settings").select("value").eq("key", "bridge_update").maybeSingle();
    const latestRow = garage.canary ? (await admin.from("admin_settings").select("value").eq("key", "bridge_latest").maybeSingle()).data : null;
    const bridge = heartbeatBridgeFields(parseBridgeUpdate((updateRow as { value?: unknown } | null)?.value), { canary: garage.canary === true, latest: (latestRow as { value?: unknown } | null)?.value });
    const parsedAgent = parseAgent(body.agent);
    if (parsedAgent.error) console.warn("[node-heartbeat] ignored agent", garage.name, parsedAgent.error);
    const agentRaw = (body.agent && typeof body.agent === "object" ? body.agent : {}) as Record<string, unknown>;
    const parsedState = parseAgentState(agentRaw.state);
    if (parsedState.kind === "ignored") console.warn("[node-heartbeat] ignored agent.state", garage.name, parsedState.error);
    const parsedNodes = parseAgentNodes(agentRaw.nodes);
    if (parsedNodes.error) console.warn("[node-heartbeat] ignored agent.nodes", garage.name, parsedNodes.error);
    const prevState = (garage.agent_state ?? null) as AgentState | null;
    const agentState = nextAgentState(prevState, parsedState);
    const transition = lifecycleTransition(prevState, agentState);
    const machineId = parseMachineId(body.machine_id); // a set machine_id never changes here; claim on first use only
    const machinePatch = claimMachineId(garage.machine_id, machineId); // { machine_id, last_machine_id } | { last_machine_id }
    const firstModels = !garage.first_models_at && payload.models.length > 0 ? { first_models_at: now } : {};
    const inventoryPatch = { models: payload.models, runtime: payload.runtime, port: payload.port };
    const { error: heartbeatError } = await admin.from("garages").update({ ...inventoryPatch, last_heartbeat_at: now, ...machinePatch, ...firstModels, agent_state: agentState, ...(parsedNodes.nodes ? { agent_nodes: parsedNodes.nodes } : {}), ...(parsedAgent.agent ? { agent: parsedAgent.agent, agent_at: now } : {}) }).eq("id", garage.id);
    if (heartbeatError) throw heartbeatError;
    await storeRuntimeKey(admin, garage.id, payload.runtime_api_key);
    await reconcilePrivateGarage(admin, { ...garage, ...inventoryPatch, mesh_ip: garage.transport === 'tunnel' ? garage.tunnel_ip : garage.mesh_ip } as RoutingGarage, payload.contexts);
    let portalResumed = false;
    if (resumeClearsPortalPause(garage, prevState, agentState, agentRaw.resumed_at)) {
      const { error: resumeErr } = await admin.from("garages").update({ paused_at: null, paused_reason: null }).eq("id", garage.id).eq("paused_by_admin", false);
      if (resumeErr) console.warn("[node-heartbeat] portal resume", garage.name, resumeErr.message);
      else { portalResumed = true; garage.paused_at = null; console.log("[node-heartbeat] garageai resume cleared portal pause", garage.name); }
    }
    // Bridge release runs on our own garages drive auto promotion (RPC ignores non-admin, non-canary garages).
    if (parsedAgent.agent?.version) {
      const errVer = updateErrorVersion(parsedAgent.agent.version, bridge.bridge_stable, parsedAgent.agent.update?.last_error);
      const { error: runErr } = await admin.rpc("record_bridge_run", { _garage_id: garage.id, _version: parsedAgent.agent.version.startsWith("v") ? parsedAgent.agent.version : `v${parsedAgent.agent.version.replace(/^bridge-/, "")}`, _error: errVer ? parsedAgent.agent.update?.last_error ?? null : null, _error_version: errVer });
      if (runErr) console.warn("[node-heartbeat] bridge run", garage.name, runErr.message);
    }
    // Managed models: store Bridge's reports, answer with what the portal still wants. Never rejects the heartbeat.
    let wanted: WantedModel[] = [];
    let offerNow: string[] = [];
    try {
      const reports = parseAgentModels((body.agent as Record<string, unknown> | undefined)?.models);
      if (reports.errors.length) console.warn("[node-heartbeat] ignored agent.models entries", garage.name, reports.errors);
      const { data: rows } = await admin.from("garage_managed_models").select("model, action, by, status, completed_mb, total_mb, reported_at").eq("garage_id", garage.id);
      const current = (rows ?? []) as ManagedRow[];
      const updates = applyReports(current, reports.models);
      for (const u of updates) {
        if (u.patch.status === "ready" && u.patch.total_mb == null) { // Bridge sent no size: use the registry's
          const { data: cm } = await admin.from("curated_models").select("download_bytes").eq("ollama_tag", u.model).not("download_bytes", "is", null).limit(1).maybeSingle();
          if (cm?.download_bytes) { u.patch.total_mb = Math.round(Number(cm.download_bytes) / 1e6); u.patch.completed_mb = u.patch.total_mb; }
        }
        await admin.from("garage_managed_models").update(u.patch).eq("garage_id", garage.id).eq("model", u.model);
        const row = current.find((r) => r.model === u.model); if (row && u.patch.status) { row.status = u.patch.status; row.reported_at = u.patch.reported_at; }
      }
      // Idempotent: every heartbeat offers fetched pulls that Bridge lists but that are not offered yet.
      const candidates = pendingOffers(current, payload.models, new Set());
      if (candidates.length) {
        const { data: inv } = await admin.from("garage_models").select("model, offered").eq("garage_id", garage.id).in("model", candidates);
        offerNow = pendingOffers(current, payload.models, new Set((inv ?? []).filter((r) => r.offered).map((r) => r.model as string)));
      }
      wanted = wantedModels(current);
    } catch (e) { console.warn("[node-heartbeat] managed models", garage.name, e instanceof Error ? e.message : e); }
    // Planned absence (maintenance/starting/away): out of routing in this heartbeat, like an admin pause.
    // No acceptance tests, no inventory pruning, no status change; in-flight requests drain on the gateway.
    if (agentState) {
      if (transition === "leave") await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true });
      return json({ ok: true, changed: transition === "leave", state: agentState.kind, wanted_models: wanted, ...bridge });
    }
    let returnTests: string[] = [];
    let backgroundTests: string[] = [];
    if (transition === "return") {
      const { data: tests } = await admin.from("garage_model_tests").select("model, passed, tested_at").eq("garage_id", garage.id).eq("inconclusive", false).order("tested_at", { ascending: false }).limit(500);
      const last = new Map<string, { passed: boolean; at: number }>();
      for (const t of (tests || []) as Array<{ model: string; passed: boolean; tested_at: string }>) if (!last.has(t.model)) last.set(t.model, { passed: t.passed, at: Date.parse(t.tested_at) });
      const { data: inv } = await admin.from("garage_models").select("model, offered").eq("garage_id", garage.id);
      const split = splitReturnModels(payload.models, last, new Set((inv ?? []).filter((r) => r.offered).map((r) => r.model as string)));
      returnTests = split.testFirst; backgroundTests = split.testAfter;
    }
    // Live before the planned state: route now, test afterwards; a failed test takes it out via the next sync.
    const runBackgroundTests = () => {
      if (!backgroundTests.length) return;
      const job = (async () => {
        try {
          const { data: fresh } = await admin.from("garages").select(GARAGE_SELECT).eq("id", garage.id).maybeSingle();
          if (!fresh) return;
          const results = await withProbeDeployments(admin, fresh as RoutingGarage, backgroundTests, (base, key, routeFor) => runAndStoreAcceptanceTests(admin, base, key, garage, backgroundTests, routeFor));
          if (results.some((r) => !r.inconclusive && !r.passed)) await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true });
        } catch (e) { console.warn("[node-heartbeat] background return test", garage.name, e instanceof Error ? e.message : e); }
      })();
      const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
      if (rt) rt.waitUntil(job);
    };
    let removedRows: string[] = [];
    try { removedRows = await applyInventoryMisses(admin, garage.id, payload.models); if (removedRows.length) console.log("[node-heartbeat] removed unreported models", garage.name, removedRows); }
    catch (e) { console.warn("[node-heartbeat] inventory", garage.name, e instanceof Error ? e.message : e); }
    const previous = new Set<string>((garage.models || []) as string[]);
    const current = new Set(payload.models);
    const added = payload.models.filter((model) => !previous.has(model));
    const removed = [...previous].filter((model) => !current.has(model));
    const contextChanges = await changedContexts(admin, garage.id, payload.contexts ?? {});
    const contextChanged = Object.keys(contextChanges).some((m) => previous.has(m));
    const changed = transition === "return" || portalResumed || offerNow.length > 0 || added.length > 0 || removedRows.length > 0 || removed.length > 0 || garage.runtime !== payload.runtime || garage.port !== payload.port || contextChanged;

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
      return json({ ok: true, changed: false, wanted_models: wanted, ...bridge });
    }

    const result = await registerGarage(admin, garage, payload, { testOnly: [...new Set([...added, ...offerNow, ...returnTests])], offer: offerNow });
    return json({ ok: true, changed: true, added, removed, contexts_changed: Object.keys(contextChanges), acceptance: result.acceptance.map(toPublicResult), offered: result.summary.offered, not_offered: result.summary.not_offered, wanted_models: wanted, ...bridge });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message.includes("connected to the mesh") || message.includes("connected to mesh")) return json({ error: message }, 409);
    console.error("[node-heartbeat] error", message);
    return json({ error: "Internal error" }, 500);
  }
});