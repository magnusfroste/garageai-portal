import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { accountTermsAccepted, ACCOUNT_TERMS_REQUIRED } from "../_shared/accountTerms.ts";
import { chatKeyName, createPortalKey } from "../_shared/portalKeys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const fail = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ success: false, error: { code, message } }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Body: { keyName, models?, showOnce?, kind?: "user" | "chat", deviceLabel? }.
// showOnce (sent by the current frontend) stores only the last 4 characters;
// without it the legacy behaviour is kept for older clients.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return fail(401, "unauthorized", "Missing or invalid authorization header");
    const { data: { user } } = await admin.auth.getUser(auth.slice(7));
    if (!user) return fail(401, "unauthorized", "Invalid authentication token");
    if (!await accountTermsAccepted(admin, user.id)) return fail(403, ACCOUNT_TERMS_ERROR_CODE, ACCOUNT_TERMS_REQUIRED);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const kind = body.kind === "chat" ? "chat" : "user";
    const name = kind === "chat" ? chatKeyName(body.deviceLabel) : String(body.keyName ?? "").trim().slice(0, 80);
    if (!name) return fail(400, "invalid_input", "Key name is required");
    const models = Array.isArray(body.models) ? body.models.filter((m): m is string => typeof m === "string").slice(0, 50) : undefined;
    const showOnce = body.showOnce === true || kind === "chat";

    const created = await createPortalKey(admin, {
      userId: user.id, name, kind, showOnce, models,
      deviceLabel: kind === "chat" ? name.replace(/^Chat · /, "") : null,
    });
    return new Response(JSON.stringify({
      success: true,
      data: { id: created.id, key: created.key, name: created.name, last4: created.last4, kind: created.kind, expires_at: null },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("generate-api-key failed:", error instanceof Error ? error.message : error);
    return fail(502, "key_create_failed", "Your key could not be created right now.");
  }
});
