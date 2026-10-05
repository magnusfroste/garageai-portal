import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getNetbirdApiUrl, netbirdHeaders, getGaragesGroupId } from "../_shared/netbirdConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(s: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseAnon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "");
    const { data: { user } } = await supabaseAnon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdminRaw } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const isAdmin = isAdminRaw === true;

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!NAME_RE.test(name)) return json({ error: "name must match ^[a-z0-9][a-z0-9-]{1,40}$" }, 400);

    if (!isAdmin && body.api_host !== undefined && body.api_host !== null && body.api_host !== "") {
      return json({ error: "api_host is not allowed" }, 400);
    }
    let apiHost: string | undefined;
    if (body.api_host !== undefined && body.api_host !== null && body.api_host !== "") {
      if (typeof body.api_host !== "string" || !/^[A-Za-z0-9.-]{1,253}$/.test(body.api_host)) {
        return json({ error: "api_host must be a hostname or IP" }, 400);
      }
      apiHost = body.api_host;
    }
    let operatorId: string | undefined = isAdmin ? undefined : user.id;
    if (isAdmin && body.operator_id !== undefined && body.operator_id !== null && body.operator_id !== "") {
      if (typeof body.operator_id !== "string" || !UUID_RE.test(body.operator_id)) {
        return json({ error: "operator_id must be a uuid" }, 400);
      }
      operatorId = body.operator_id;
    }
    let createSetupKey = body.create_setup_key === undefined ? true : body.create_setup_key === true;

    // Insert or reuse garage
    const { data: existing, error: selErr } = await admin.from("garages").select("*").eq("name", name).maybeSingle();
    if (selErr) throw selErr;

    if (!isAdmin) {
      if (existing && existing.operator_id !== user.id) {
        return json({ error: "name taken" }, 409);
      }
      if (!existing) {
        const { count, error } = await admin.from("garages").select("id", { count: "exact", head: true }).eq("operator_id", user.id);
        if (error) throw error;
        if ((count ?? 0) >= 5) return json({ error: "You can have at most 5 garages" }, 409);
      }
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: calls, error: rlErr } = await admin
        .from("garage_tokens")
        .select("id, garages!inner(operator_id)", { count: "exact", head: true })
        .eq("garages.operator_id", user.id)
        .gte("created_at", since);
      if (rlErr) throw rlErr;
      if ((calls ?? 0) >= 10) return json({ error: "Too many requests: max 10 per 24 hours" }, 429);
    }

    let garage;
    if (existing) {
      const patch: Record<string, unknown> = {};
      if (apiHost !== undefined) patch.api_host = apiHost;
      if (operatorId !== undefined) patch.operator_id = operatorId;
      if (Object.keys(patch).length) {
        const { data, error } = await admin.from("garages").update(patch).eq("id", existing.id).select("*").single();
        if (error) throw error;
        garage = data;
      } else {
        garage = existing;
      }
    } else {
      const { data, error } = await admin
        .from("garages")
        .insert({ name, api_host: apiHost ?? null, operator_id: operatorId ?? null, status: "pending" })
        .select("*")
        .single();
      if (error) throw error;
      garage = data;
    }

    if (!isAdmin && !(body.create_setup_key === false && garage.netbird_peer_id)) createSetupKey = true;

    // Token: revoke old, store hash of new
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    const registerToken = "grg_" + toHex(raw);
    const tokenHash = await sha256Hex(registerToken);

    const { error: revErr } = await admin
      .from("garage_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("garage_id", garage.id)
      .is("revoked_at", null);
    if (revErr) throw revErr;

    const { error: insErr } = await admin.from("garage_tokens").insert({ garage_id: garage.id, token_hash: tokenHash });
    if (insErr) throw insErr;

    const netbirdApiUrl = await getNetbirdApiUrl(admin);

    let setupKey: string | null = null;
    if (createSetupKey) {
      const groupId = await getGaragesGroupId(netbirdApiUrl);
      const res = await fetch(`${netbirdApiUrl}/setup-keys`, {
        method: "POST",
        headers: netbirdHeaders(),
        body: JSON.stringify({
          name,
          type: "one-off",
          expires_in: 259200,
          auto_groups: [groupId],
          usage_limit: 1,
          ephemeral: false,
        }),
      });
      if (!res.ok) {
        console.error("[create-garage] NetBird setup-key creation failed", { status: res.status, garage: name });
        return json({ error: `NetBird setup key creation failed (status ${res.status})` }, 502);
      }
      const data = await res.json();
      setupKey = data?.key ?? null;
    }

    console.log("[create-garage] garage ready", { garage: name, reused: !!existing, setup_key_created: !!setupKey });

    return json({
      garage,
      register_token: registerToken,
      setup_key: setupKey,
      register_url: `${SUPABASE_URL}/functions/v1/register-node`,
      management_url: netbirdApiUrl.replace(/\/api$/, ""),
    });
  } catch (e) {
    console.error("[create-garage] error:", e instanceof Error ? e.message : "unknown");
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
