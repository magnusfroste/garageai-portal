import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";
import { getNetbirdApiUrl, netbirdHeaders } from "../_shared/netbirdConfig.ts";
import { syncModels } from "../_shared/syncModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ALLOWED_PORTS = [11434, 1234, 8080, 8000];
const MODEL_RE = /^[A-Za-z0-9._:/-]{1,128}$/;
const sanitize = (m: string) => m.replace(/[^A-Za-z0-9._-]/g, "-");

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

interface NetbirdPeer {
  id: string;
  name: string;
  ip: string;
  groups?: Array<{ id: string; name: string }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MASTER_KEY = Deno.env.get("LITELLM_MASTER_KEY");
    if (!MASTER_KEY) return json({ error: "Server not configured" }, 500);

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

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

    if (body.name !== garage.name) return json({ error: "name does not match the garage for this token" }, 400);

    // 2. Validate
    const port = body.port;
    if (typeof port !== "number" || !Number.isInteger(port) || !ALLOWED_PORTS.includes(port)) {
      return json({ error: `port must be one of ${ALLOWED_PORTS.join(", ")}` }, 400);
    }
    const models = body.models;
    if (!Array.isArray(models) || models.length < 1 || models.length > 20 ||
        !models.every((m) => typeof m === "string" && MODEL_RE.test(m))) {
      return json({ error: "models must be 1-20 strings matching ^[A-Za-z0-9._:/-]{1,128}$" }, 400);
    }
    const uniqueModels = Array.from(new Set(models as string[]));
    const runtime = body.runtime;
    if (typeof runtime !== "string" || runtime.length < 1 || runtime.length > 32) {
      return json({ error: "runtime must be a short string (1-32 chars)" }, 400);
    }
    let runtimeApiKey: string | undefined;
    if (body.runtime_api_key !== undefined && body.runtime_api_key !== null && body.runtime_api_key !== "") {
      if (typeof body.runtime_api_key !== "string" || body.runtime_api_key.length > 512) {
        return json({ error: "runtime_api_key must be a string of at most 512 chars" }, 400);
      }
      runtimeApiKey = body.runtime_api_key;
    }

    // 3. Look up peer in NetBird (do not trust body.mesh_ip)
    const netbirdApiUrl = await getNetbirdApiUrl(admin);
    const peersRes = await fetch(`${netbirdApiUrl}/peers`, { headers: netbirdHeaders() });
    if (!peersRes.ok) {
      console.error("[register-node] NetBird GET /peers failed", { status: peersRes.status });
      return json({ error: "Could not query mesh" }, 502);
    }
    const peers = (await peersRes.json()) as NetbirdPeer[];
    const peer = peers.find((p) => p.name === garage.name && (p.groups || []).some((g) => g.name === "garages"));
    if (!peer) return json({ error: "node is not connected to the mesh yet" }, 409);

    const meshIp = peer.ip;
    if (typeof body.mesh_ip === "string" && body.mesh_ip !== meshIp) {
      console.log("[register-node] reported mesh_ip differs from NetBird", { garage: garage.name, reported: body.mesh_ip, netbird: meshIp });
    }

    // 4. API base
    const host = garage.api_host || meshIp;
    const apiBase = `http://${host}:${port}/v1`;

    // 5. Register deployments in LiteLLM
    const litellm = await getProxyBaseUrl(admin);
    const llHeaders = { Authorization: `Bearer ${MASTER_KEY}`, "Content-Type": "application/json" };
    const registeredIds = new Set<string>();

    for (const model of uniqueModels) {
      const tiers = [
        {
          tier: "dedicated",
          id: `${garage.name}__${sanitize(model)}__dedicated`,
          model_name: `garage/${garage.name}/${model}`,
          inCost: Number(garage.dedicated_input_cost_per_million),
          outCost: Number(garage.dedicated_output_cost_per_million),
        },
        {
          tier: "pool",
          id: `${garage.name}__${sanitize(model)}__pool`,
          model_name: model,
          inCost: Number(garage.pool_input_cost_per_million),
          outCost: Number(garage.pool_output_cost_per_million),
        },
      ];

      for (const t of tiers) {
        try {
          await fetch(`${litellm}/model/delete`, { method: "POST", headers: llHeaders, body: JSON.stringify({ id: t.id }) });
        } catch { /* ignore */ }

        const res = await fetch(`${litellm}/model/new`, {
          method: "POST",
          headers: llHeaders,
          body: JSON.stringify({
            model_name: t.model_name,
            litellm_params: {
              model: "openai/" + model,
              api_base: apiBase,
              api_key: runtimeApiKey || "garage-node",
              input_cost_per_token: t.inCost / 1e6,
              output_cost_per_token: t.outCost / 1e6,
            },
            model_info: {
              id: t.id,
              mode: "chat",
              garage: garage.name,
              operator_id: garage.operator_id,
              runtime,
              garage_tier: t.tier,
            },
          }),
        });
        if (!res.ok) {
          console.error("[register-node] LiteLLM /model/new failed", { status: res.status, id: t.id });
          return json({ error: `Failed to register model ${model} (${t.tier}) in proxy (status ${res.status})` }, 502);
        }
        registeredIds.add(t.id);
      }
    }

    // 6. Remove stale deployments for this garage
    try {
      const infoRes = await fetch(`${litellm}/model/info`, { headers: llHeaders });
      if (infoRes.ok) {
        const info = await infoRes.json();
        const prefix = `${garage.name}__`;
        for (const d of (info?.data || []) as Array<{ model_info?: { id?: string } }>) {
          const id = d.model_info?.id;
          if (id && id.startsWith(prefix) && !registeredIds.has(id)) {
            await fetch(`${litellm}/model/delete`, { method: "POST", headers: llHeaders, body: JSON.stringify({ id }) });
            console.log("[register-node] removed stale deployment", { id });
          }
        }
      } else {
        console.warn("[register-node] LiteLLM /model/info failed", { status: infoRes.status });
      }
    } catch (e) {
      console.warn("[register-node] stale cleanup error:", e instanceof Error ? e.message : "unknown");
    }

    // 7. Update garage row (runtime_api_key is never stored here)
    const { error: updErr } = await admin.from("garages").update({
      runtime,
      port,
      models: uniqueModels,
      mesh_ip: meshIp,
      netbird_peer_id: peer.id,
      status: "online",
      last_registered_at: new Date().toISOString(),
    }).eq("id", garage.id);
    if (updErr) throw updErr;

    // 8. Refresh catalogue so the garage's models appear immediately
    let catalogSynced = true;
    try {
      await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true });
    } catch (e) {
      catalogSynced = false;
      console.error("[register-node] catalog sync failed:", e instanceof Error ? e.message : "unknown");
    }

    console.log("[register-node] registered", { garage: garage.name, api_base: apiBase, models: uniqueModels.length, catalog_synced: catalogSynced });
    return json({ ok: true, garage: garage.name, api_base: apiBase, models: uniqueModels, catalog_synced: catalogSynced });
  } catch (e) {
    console.error("[register-node] error:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
