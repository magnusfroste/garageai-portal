// Bridge device-link approval by a signed-in operator. Actions: lookup (show the machine), approve, deny.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { NAME_RE, entryFor, linkWantsSetupKey, machineConflict, normaliseUserCode } from "../_shared/bridgeLink.ts";
import { termsAccepted } from "../_shared/garageTerms.ts";
import { CredentialError, countOwnedGarages, issueGarageCredentials, loadGarageByName } from "../_shared/garageCredentials.ts";
import { garageLimitReached } from "../_shared/garageCredentialRules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PUBLIC_FIELDS = "id, user_code, status, machine_id, hostname, os, arch, bridge_version, gpu, memory_gb, runtime, models, suggested_name, requested_ip_country, transport, created_at, expires_at";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "");
    const { data: { user } } = await anon.auth.getUser(auth.slice(7));
    if (!user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const userCode = normaliseUserCode(body.user_code);
    if (!userCode) return json({ error: "invalid_code" }, 400);
    const action = body.action;
    if (action !== "lookup" && action !== "approve" && action !== "deny") return json({ error: "action must be lookup, approve or deny" }, 400);

    const { data: link, error } = await admin.from("bridge_links").select(PUBLIC_FIELDS).eq("user_code", userCode).maybeSingle();
    if (error) throw error;
    const now = Date.now();
    if (!link) return json({ error: "not_found" }, 404);
    if (link.status !== "pending") return json({ error: "not_pending", status: link.status }, 409);
    if (new Date(link.expires_at).getTime() < now) {
      await admin.from("bridge_links").update({ status: "expired", credentials: null }).eq("id", link.id);
      return json({ error: "expired" }, 410);
    }
    if (action === "lookup") {
      const { id: _id, ...shown } = link;
      const { data: adm } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      const garage_limit_reached = garageLimitReached(await countOwnedGarages(admin, user.id), adm === true);
      return json({ link: { ...shown, garage_limit_reached } });
    }

    if (action === "deny") {
      await admin.from("bridge_links").update({ status: "denied" }).eq("id", link.id).eq("status", "pending");
      return json({ status: "denied" });
    }

    const name = typeof body.garage_name === "string" ? body.garage_name.trim().toLowerCase() : "";
    if (!NAME_RE.test(name)) return json({ error: "garage_name must match ^[a-z0-9][a-z0-9-]{1,40}$" }, 400);
    const { data: isAdminRaw } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const isAdmin = isAdminRaw === true;

    const existing = await loadGarageByName(admin, name);
    if (existing?.connection_type === "endpoint") return json({ error: "provider endpoints cannot be linked to a machine" }, 400);
    const accepted = termsAccepted(body);
    if (!accepted && (!existing || !existing.terms_accepted_at)) return json({ error: "terms must be accepted" }, 400);
    const conflict = machineConflict(existing?.machine_id, link.machine_id, body.replace_machine === true);
    if (conflict === "mismatch") return json({ error: "machine_mismatch", machine_hostname: existing?.machine_hostname ?? null }, 409);

    const issued = await issueGarageCredentials(admin, {
      userId: user.id, isAdmin, name, adminPanel: false, operatorId: user.id,
      setupKeyRequested: linkWantsSetupKey(link.transport, !!existing?.netbird_peer_id, conflict), acceptTerms: accepted, machineId: link.machine_id,
      noNetbird: link.transport === "tunnel",
    });

    const { data: prof } = await admin.from("profiles").select("connect_page_seen_at").eq("id", user.id).maybeSingle();
    const approvedNow = Date.now();
    const { data: updated } = await admin.from("bridge_links").update({
      entry: entryFor(prof?.connect_page_seen_at, approvedNow),
      status: "approved", garage_id: issued.garage.id, approved_by: user.id, approved_at: new Date(approvedNow).toISOString(),
      credentials: { register_token: issued.register_token, setup_key: issued.setup_key, register_url: issued.register_url, management_url: issued.management_url },
    }).eq("id", link.id).eq("status", "pending").select("id");
    if (!updated?.length) return json({ error: "not_pending" }, 409);

    await admin.from("garages").update({
      ...(link.machine_id ? { machine_id: link.machine_id } : {}),
      ...(link.hostname ? { machine_hostname: link.hostname } : {}),
    }).eq("id", issued.garage.id);
    await admin.from("onboarding_events").insert({
      garage_id: issued.garage.id, step: "link", status: "done", machine_id: link.machine_id,
      message: `Linked from ${link.hostname || "an unnamed machine"} in the browser`.slice(0, 500),
      script_version: link.bridge_version, node_name: link.hostname, runtime: link.runtime, os: link.os, arch: link.arch, gpu: link.gpu,
      memory_gb: link.memory_gb != null ? String(link.memory_gb) : null,
    });
    console.log("[bridge-link-approve] approved", { garage: name, replaced: conflict === "replace", setup_key_created: !!issued.setup_key });
    return json({ status: "approved", garage: { id: issued.garage.id, name: issued.garage.name } });
  } catch (e) {
    if (e instanceof CredentialError) return json({ error: e.message }, e.status);
    console.error("[bridge-link-approve] error", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
