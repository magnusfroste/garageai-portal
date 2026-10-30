import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const { data: { user } } = await admin.auth.getUser(auth.slice(7));
  if (!user) return json({ error: "unauthorized" }, 401);
  try {
    const { data: saved, error: savedError } = await admin.from("buyer_first_requests").select("first_request_at").eq("user_id", user.id).maybeSingle();
    if (savedError) throw savedError;
    if (saved) return json({ firstRequestAt: saved.first_request_at });
    const { data: profile, error } = await admin.from("profiles").select("litellm_user_id, created_at").eq("id", user.id).single();
    if (error || !profile) throw new Error("profile_unavailable");
    const base = await getProxyBaseUrl(admin);
    const url = new URL(`${base}/spend/logs/v2`);
    url.search = new URLSearchParams({ user_id: profile.litellm_user_id || user.id, start_date: profile.created_at.slice(0, 10), end_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), status_filter: "success", page: "1", page_size: "1", sort_by: "startTime", sort_order: "asc", exclude_internal_health_checks: "true" }).toString();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${Deno.env.get("LITELLM_MASTER_KEY") ?? ""}` }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("usage_unavailable");
    const body = await response.json();
    const rows = body.data ?? body.response;
    if (!Array.isArray(rows)) throw new Error("usage_unavailable");
    const at = rows[0]?.startTime;
    if (!at) return json({ firstRequestAt: null });
    if (!Number.isFinite(Date.parse(at))) throw new Error("usage_unavailable");
    const { error: writeError } = await admin.from("buyer_first_requests").upsert({ user_id: user.id, first_request_at: at }, { onConflict: "user_id", ignoreDuplicates: true });
    if (writeError) throw writeError;
    return json({ firstRequestAt: at });
  } catch {
    return json({ error: "usage_unavailable" }, 502);
  }
});