// Receives step-by-step progress from the connect script. Auth = register token (same as register-node); token never stored or logged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };
const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { ...corsHeaders, ...(body === undefined ? {} : { "Content-Type": "application/json" }) } });

const STATUSES = new Set(["started", "warning", "failed", "stopped", "done"]);
const SHORT = ["step", "script_version", "node_name", "runtime", "port", "os", "arch", "gpu", "memory_gb"] as const;
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const KEEP = 200;

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
const text = (v: unknown, max: number) => (typeof v === "string" || typeof v === "number") ? String(v).slice(0, max) : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  try {
    const auth = req.headers.get("Authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return reply(401, { error: "Unauthorized" });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tok } = await admin.from("garage_tokens").select("garage_id").eq("token_hash", await sha256Hex(token)).is("revoked_at", null).maybeSingle();
    if (!tok) return reply(401, { error: "Unauthorized" });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return reply(400, { error: "Invalid JSON body" }); }
    if (!body || typeof body !== "object") return reply(400, { error: "Invalid body" });
    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (!STATUSES.has(status)) return reply(400, { error: "status must be one of started, warning, failed, stopped, done" });
    const row: Record<string, string | null> = { garage_id: tok.garage_id, status, message: text(body.message, 500) };
    for (const k of SHORT) row[k] = text(body[k], 200);
    if (!row.step) return reply(400, { error: "step is required" });

    const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const { count } = await admin.from("onboarding_events").select("id", { count: "exact", head: true }).eq("garage_id", tok.garage_id).gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT) return reply(429, { error: "Too many events" });

    const { error } = await admin.from("onboarding_events").insert(row);
    if (error) throw error;

    const { data: old } = await admin.from("onboarding_events").select("id").eq("garage_id", tok.garage_id).order("created_at", { ascending: false }).range(KEEP, KEEP + 500);
    if (old?.length) await admin.from("onboarding_events").delete().in("id", old.map((r: { id: string }) => r.id));
    return reply(204);
  } catch (e) {
    console.error("[onboarding-report] error", e instanceof Error ? e.message : "unknown");
    return reply(500, { error: "Internal error" });
  }
});
