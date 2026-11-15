import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildGatewayTargets } from "../_shared/gatewayTargets.ts";
import { gatewayJson, isGatewayAuthorized } from "../_shared/gatewayAuth.ts";

Deno.serve(async (req) => {
  if (req.method !== "GET") return gatewayJson({ error: "Method not allowed" }, 405);
  if (!(await isGatewayAuthorized(req))) return gatewayJson({ error: "Unauthorized" }, 401);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const targets = await buildGatewayTargets(admin);
    return gatewayJson({ targets });
  } catch (e) {
    console.error("[gateway-targets] error", e instanceof Error ? e.message : "unknown");
    return gatewayJson({ error: "Internal error" }, 500);
  }
});
