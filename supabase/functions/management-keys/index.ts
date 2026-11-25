// Portal (signed-in owner) management of management keys: create, rotate, revoke.
// The value is shown once; only its sha256 hash and last 4 characters are stored.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@4";
import { newManagementKeyValue, sha256Hex } from "../_shared/customerKeys.ts";

const MAX_ACTIVE = 10;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().trim().min(1).max(80), expires_at: z.string().datetime({ offset: true }).nullable().optional() }),
  z.object({ action: z.literal("rotate"), id: z.string().uuid() }),
  z.object({ action: z.literal("revoke"), id: z.string().uuid() }),
]);

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: { user }, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, 400);
    const input = parsed.data;
    const now = new Date();
    const issue = async (name: string, expiresAt: string | null) => {
      const value = newManagementKeyValue();
      const { data, error } = await db.from("management_keys").insert({ user_id: user.id, name, key_hash: await sha256Hex(value), key_last4: value.slice(-4), expires_at: expiresAt })
        .select("id, name, key_last4, created_at, expires_at").single();
      if (error) throw error;
      return { ...data, key: value };
    };
    if (input.action === "create") {
      if (input.expires_at && Date.parse(input.expires_at) <= now.getTime()) return json({ error: "Expiry must be in the future" }, 400);
      const { count } = await db.from("management_keys").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("revoked_at", null);
      if ((count ?? 0) >= MAX_ACTIVE) return json({ error: `At most ${MAX_ACTIVE} management keys` }, 400);
      return json({ key: await issue(input.name, input.expires_at ?? null) });
    }
    const { data: existing } = await db.from("management_keys").select("id, name, expires_at").eq("id", input.id).eq("user_id", user.id).is("revoked_at", null).maybeSingle();
    if (!existing) return json({ error: "Management key not found" }, 404);
    const { error } = await db.from("management_keys").update({ revoked_at: now.toISOString() }).eq("id", existing.id).eq("user_id", user.id);
    if (error) throw error;
    if (input.action === "revoke") return json({ revoked: true });
    const keepExpiry = existing.expires_at && Date.parse(existing.expires_at) > now.getTime() ? existing.expires_at : null;
    return json({ key: await issue(existing.name, keepExpiry) });
  } catch (e) {
    const message = e && typeof e === "object" && "message" in e && typeof e.message === "string" ? e.message : "Could not update management keys";
    return json({ error: message }, 500);
  }
});
