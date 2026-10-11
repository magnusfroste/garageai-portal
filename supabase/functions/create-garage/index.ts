import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { termsAccepted } from "../_shared/garageTerms.ts";
import { CredentialError, issueGarageCredentials } from "../_shared/garageCredentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


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
    if (!termsAccepted(body)) return json({ error: "terms must be accepted" }, 400);

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
    // Only Admin → Garages (source "admin", admin role) may create unowned rows or pick an owner.
    // Every other caller — including admins using the operator wizard — owns the garage.
    const adminPanel = isAdmin && body.source === "admin";
    let operatorId: string | undefined = adminPanel ? undefined : user.id;
    if (adminPanel && body.operator_id !== undefined && body.operator_id !== null && body.operator_id !== "") {
      if (typeof body.operator_id !== "string" || !UUID_RE.test(body.operator_id)) {
        return json({ error: "operator_id must be a uuid" }, 400);
      }
      operatorId = body.operator_id;
    }
    const issued = await issueGarageCredentials(admin, {
      userId: user.id, isAdmin, name, apiHost, adminPanel, operatorId,
      setupKeyRequested: body.create_setup_key, acceptTerms: true,
    });

    console.log("[create-garage] garage ready", { garage: name, reused: issued.reused, setup_key_created: !!issued.setup_key });

    return json({
      garage: issued.garage,
      register_token: issued.register_token,
      setup_key: issued.setup_key,
      register_url: issued.register_url,
      management_url: issued.management_url,
    });
  } catch (e) {
          console.error("[create-garage] old peer delete failed", { garage: name, error: e instanceof Error ? e.message : "unknown" });
        }
      }
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
    if (e instanceof CredentialError) return json({ error: e.message }, e.status);
    console.error("[create-garage] error:", e instanceof Error ? e.message : "unknown");
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
