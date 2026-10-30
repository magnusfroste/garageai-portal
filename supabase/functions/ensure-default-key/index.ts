import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { accountTermsAccepted } from "../_shared/accountTerms.ts";
import { createPortalKey } from "../_shared/portalKeys.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Creates the account's "Default" key once, after the terms are accepted, and
// returns its value exactly once. Accounts that already had keys were marked
// done by the migration, so they never get an extra key.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const { data: { user } } = await admin.auth.getUser(auth.slice(7));
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!await accountTermsAccepted(admin, user.id)) return json({ created: false, reason: ACCOUNT_TERMS_ERROR_CODE });

  // Atomic claim: only one request can create the default key.
  const { data: claimed, error } = await admin.from("profiles").update({ default_key_at: new Date().toISOString() })
    .eq("id", user.id).is("default_key_at", null).select("id");
  if (error) return json({ error: "key_create_failed" }, 502);
  if (!claimed?.length) return json({ created: false });
  try {
    const key = await createPortalKey(admin, { userId: user.id, name: "Default", kind: "default", showOnce: true });
    return json({ created: true, id: key.id, key: key.key, name: key.name, last4: key.last4 });
  } catch (e) {
    console.error("default key failed:", e instanceof Error ? e.message : e);
    await admin.from("profiles").update({ default_key_at: null }).eq("id", user.id);
    return json({ error: "key_create_failed" }, 502);
  }
});
