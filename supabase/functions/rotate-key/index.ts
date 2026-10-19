import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { accountTermsAccepted } from "../_shared/accountTerms.ts";
import { createPortalKey, type KeyKind } from "../_shared/portalKeys.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Rotate = a new key with the same name (shown once). The old key is revoked
// separately via revoke-key after the user confirms.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const { data: { user } } = await admin.auth.getUser(auth.slice(7));
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!await accountTermsAccepted(admin, user.id)) return json({ error: "terms_required" }, 403);
  const body = await req.json().catch(() => ({})) as { keyId?: unknown };
  if (typeof body.keyId !== "string") return json({ error: "invalid_input" }, 400);
  const { data: old } = await admin.from("api_keys").select("id, user_id, name, kind, device_label, is_active").eq("id", body.keyId).maybeSingle();
  if (!old || old.user_id !== user.id || !old.is_active) return json({ error: "not_found" }, 404);
  try {
    const key = await createPortalKey(admin, { userId: user.id, name: old.name, kind: old.kind as KeyKind, deviceLabel: old.device_label, showOnce: true });
    return json({ id: key.id, key: key.key, name: key.name, last4: key.last4, old_id: old.id });
  } catch (e) {
    console.error("rotate failed:", e instanceof Error ? e.message : e);
    return json({ error: "key_create_failed" }, 502);
  }
});
