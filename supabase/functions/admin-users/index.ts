import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";
import { ensureLiteLLMUser } from "../_shared/litellmUsers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Server configuration missing" }, 500);
  }

  // Verify auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return jsonResponse({ error: "Invalid token" }, 401);
  }

  // Check admin role server-side
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  if (!isAdmin) {
    return jsonResponse({ error: "Forbidden: admin role required" }, 403);
  }

  // === GET: List all users with profiles and key counts ===
  if (req.method === "GET") {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, company, litellm_user_id, starting_credit_usd, purchased_credits_usd, created_at")
      .order("created_at", { ascending: false });

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return jsonResponse({ error: "Failed to fetch users" }, 500);
    }

    // Get API key counts per user
    const { data: keyCounts, error: keyError } = await supabase
      .from("api_keys")
      .select("user_id");

    if (keyError) {
      console.error("Error fetching key counts:", keyError);
    }

    const keyCountMap: Record<string, number> = {};
    if (keyCounts) {
      for (const row of keyCounts) {
        keyCountMap[row.user_id] = (keyCountMap[row.user_id] || 0) + 1;
      }
    }

    // Fetch LiteLLM budget info for users that have litellm_user_id
    const LITELLM_MASTER_KEY = Deno.env.get('LITELLM_MASTER_KEY') || '';
    const budgetMap: Record<string, { max_budget: number; spend: number }> = {};

    if (LITELLM_MASTER_KEY) {
      const usersWithLitellm = profiles.filter((p: any) => p.litellm_user_id);
      const proxyBase = await getProxyBaseUrl(supabase).catch(() => null);
      if (proxyBase) await Promise.all(usersWithLitellm.map(async (p: any) => {
        try {
          const url = new URL(`${proxyBase}/user/info`);
          url.searchParams.set('user_id', p.litellm_user_id);
          const resp = await fetch(url.toString(), {
            headers: { 'Authorization': `Bearer ${LITELLM_MASTER_KEY}` },
          });
          if (resp.ok) {
            const data = await resp.json();
            const info = data.user_info || data;
            budgetMap[p.id] = {
              max_budget: Number(info.max_budget ?? 0),
              spend: Number(info.spend ?? 0),
            };
          }
        } catch (e) {
          console.error(`Failed to fetch LiteLLM info for ${p.id}:`, e);
        }
      }));
    }

    const users = profiles.map((p: any) => ({
      ...p,
      api_key_count: keyCountMap[p.id] || 0,
      litellm_budget: budgetMap[p.id] || null,
    }));

    return jsonResponse({ users });
  }

  // === PATCH: Update user settings ===
  if (req.method === "PATCH") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (body.action === "repair_litellm_users") {
      const { data: profiles, error } = await supabase.from("profiles").select("id, email, litellm_user_id, starting_credit_usd, purchased_credits_usd");
      if (error) return jsonResponse({ error: "Failed to fetch users" }, 500);
      let repaired = 0, failed = 0;
      for (const profile of profiles || []) {
        try { await ensureLiteLLMUser(supabase, profile); repaired++; } catch { failed++; }
      }
      return jsonResponse({ success: failed === 0, repaired, failed });
    }

    const { user_id, litellm_max_budget } = body as {
      user_id?: string;
      litellm_max_budget?: number;
    };

    if (!user_id) {
      return jsonResponse({ error: "user_id is required" }, 400);
    }

    if (!UUID_REGEX.test(user_id)) {
      return jsonResponse({ error: "user_id must be a valid UUID" }, 400);
    }

    // Update LiteLLM user budget if requested
    if (typeof litellm_max_budget === "number" && litellm_max_budget >= 0) {
      const LITELLM_MASTER_KEY = Deno.env.get('LITELLM_MASTER_KEY') || '';
      
      // Get litellm_user_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, litellm_user_id, starting_credit_usd, purchased_credits_usd")
        .eq("id", user_id)
        .single();

      if (profile && LITELLM_MASTER_KEY) {
        try {
          const purchased = Math.max(0, litellm_max_budget - Number(profile.starting_credit_usd || 0));
          const { error: updateError } = await supabase.from("profiles").update({ purchased_credits_usd: purchased }).eq("id", user_id);
          if (updateError) throw updateError;
          await ensureLiteLLMUser(supabase, { ...profile, purchased_credits_usd: purchased });
        } catch (e) {
          console.error('LiteLLM budget update error:', e);
          return jsonResponse({ error: "Failed to update LiteLLM budget" }, 500);
        }
      } else if (!profile) {
        return jsonResponse({ error: "User profile not found" }, 404);
      }
    }

    if (typeof litellm_max_budget !== "number") {
      return jsonResponse({ error: "No valid updates provided" }, 400);
    }

    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});
