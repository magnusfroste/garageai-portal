import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchRouteMap, publicModelName } from '../_shared/modelNames.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Missing authorization" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return json({ error: "Invalid token" }, 401);
  }

  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  if (!isAdmin) {
    return json({ error: "Forbidden" }, 403);
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  // === Credit transactions ===
  if (type === "credits") {
    const { data: transactions, error } = await supabase
      .from("credit_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("credits error:", error);
      return json({ error: "Failed to fetch transactions" }, 500);
    }

    // Fetch profiles for user_ids
    const userIds = [...new Set((transactions || []).map((t: any) => t.user_id))];
    const profileMap: Record<string, { full_name: string | null; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      for (const p of profiles || []) {
        profileMap[p.id] = { full_name: p.full_name, email: p.email };
      }
    }

    let totalRevenue = 0;
    const enriched = (transactions || []).map((t: any) => {
      totalRevenue += Number(t.amount_usd || 0);
      return { ...t, profiles: profileMap[t.user_id] || null };
    });

    return json({ transactions: enriched, totalRevenue });
  }

  // === API keys overview — grouped by user with token sums ===
  if (type === "keys") {
    const { data: keys, error } = await supabase
      .from("api_keys")
      .select("id, name, is_active, created_at, revoked_at, user_id")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("keys error:", error);
      return json({ error: "Failed to fetch keys" }, 500);
    }

    // Aggregate tokens_used per user from token_usage
    const { data: tokenAgg, error: tokenErr } = await supabase
      .from("token_usage")
      .select("user_id, tokens_used");

    const userTokens: Record<string, number> = {};
    if (!tokenErr && tokenAgg) {
      for (const row of tokenAgg) {
        userTokens[row.user_id] = (userTokens[row.user_id] || 0) + Number(row.tokens_used || 0);
      }
    }

    const userIds = [...new Set((keys || []).map((k: any) => k.user_id))];
    const profileMap: Record<string, { full_name: string | null; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      for (const p of profiles || []) {
        profileMap[p.id] = { full_name: p.full_name, email: p.email };
      }
    }

    const enriched = (keys || []).map((k: any) => ({
      ...k,
      profiles: profileMap[k.user_id] || null,
    }));

    // Build per-user summary
    const userSummary = userIds.map((uid) => {
      const userKeys = (keys || []).filter((k: any) => k.user_id === uid);
      return {
        user_id: uid,
        full_name: profileMap[uid]?.full_name || null,
        email: profileMap[uid]?.email || "unknown",
        total_keys: userKeys.length,
        active_keys: userKeys.filter((k: any) => k.is_active && !k.revoked_at).length,
        total_tokens: userTokens[uid] || 0,
      };
    });

    return json({ keys: enriched, userSummary });
  }

  // === Usage statistics — fetched server-side from LiteLLM proxy ===
  // Uses /global/spend/report (pre-aggregated) for speed instead of scanning
  // local token_usage table. Falls back to token_usage if proxy unavailable.
  if (type === "usage") {
    const { getProxyBaseUrl } = await import("../_shared/proxyConfig.ts");
    const LITELLM_BASE = await getProxyBaseUrl(supabase).catch(() => "");
    const LITELLM_MASTER_KEY = Deno.env.get("LITELLM_MASTER_KEY") || "";

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    let totalCost = 0;
    let totalTokens = 0;
    let totalRequests = 0;
    const modelStats: Record<string, { cost: number; tokens: number; requests: number; runtimes: Set<string> }> = {};
    const routeMap = LITELLM_MASTER_KEY && LITELLM_BASE ? await fetchRouteMap(LITELLM_BASE, LITELLM_MASTER_KEY) : new Map<string, string>();
    const publicNames = new Set(routeMap.values());
    const statFor = (raw: string, group?: unknown) => {
      const name = publicModelName(group, raw, routeMap, publicNames);
      const key = name === 'unknown' ? raw || 'unknown' : name;
      if (!modelStats[key]) modelStats[key] = { cost: 0, tokens: 0, requests: 0, runtimes: new Set() };
      if (raw && raw !== key) modelStats[key].runtimes.add(raw);
      return modelStats[key];
    };
    const userStats: Record<string, { cost: number; requests: number }> = {};

    if (LITELLM_MASTER_KEY && LITELLM_BASE) {
      try {
        // /global/spend/report aggregates by model server-side
        const modelUrl = `${LITELLM_BASE}/global/spend/report?start_date=${fmt(start)}&end_date=${fmt(end)}&group_by=model`;
        const tagUrl = `${LITELLM_BASE}/global/spend/report?start_date=${fmt(start)}&end_date=${fmt(end)}&group_by=api_key`;

        const [modelRes, tagRes] = await Promise.all([
          fetch(modelUrl, { headers: { Authorization: `Bearer ${LITELLM_MASTER_KEY}` } }),
          fetch(tagUrl, { headers: { Authorization: `Bearer ${LITELLM_MASTER_KEY}` } }),
        ]);

        if (modelRes.ok) {
          const modelData = await modelRes.json();
          const rows = Array.isArray(modelData) ? modelData : (modelData.results || modelData.data || []);
          for (const r of rows) {
            // Each row may contain breakdown.models or direct model fields
            const breakdown = r.breakdown?.models || r.models || [];
            if (Array.isArray(breakdown) && breakdown.length > 0) {
              for (const m of breakdown) {
                const st = statFor(m.model || m.name || "unknown", m.model_group);
                st.cost += Number(m.spend ?? m.metrics?.spend ?? 0);
                st.tokens += Number(m.total_tokens ?? m.metrics?.total_tokens ?? 0);
                st.requests += Number(m.api_requests ?? m.metrics?.api_requests ?? 0);
              }
            } else if (r.model) {
              const st = statFor(r.model, r.model_group);
              st.cost += Number(r.spend ?? 0);
              st.tokens += Number(r.total_tokens ?? 0);
              st.requests += Number(r.api_requests ?? 0);
            }
          }
        } else {
          console.warn("global/spend/report (model) failed:", modelRes.status);
        }

        // Aggregate per api_key, then map to user_ids via api_keys table
        if (tagRes.ok) {
          const tagData = await tagRes.json();
          const rows = Array.isArray(tagData) ? tagData : (tagData.results || tagData.data || []);
          const keyAgg: Record<string, { cost: number; requests: number }> = {};
          for (const r of rows) {
            const breakdown = r.breakdown?.api_keys || r.api_keys || [];
            const list = Array.isArray(breakdown) && breakdown.length > 0 ? breakdown : [r];
            for (const k of list) {
              const token = k.api_key || k.key || k.token;
              if (!token) continue;
              if (!keyAgg[token]) keyAgg[token] = { cost: 0, requests: 0 };
              keyAgg[token].cost += Number(k.spend ?? k.metrics?.spend ?? 0);
              keyAgg[token].requests += Number(k.api_requests ?? k.metrics?.api_requests ?? 0);
            }
          }

          // Resolve tokens → user_ids
          const tokens = Object.keys(keyAgg);
          if (tokens.length > 0) {
            const { data: keyRows } = await supabase
              .from("api_keys")
              .select("user_id, key_value, litellm_token")
              .or(tokens.map((t) => `litellm_token.eq.${t},key_value.eq.${t}`).join(","));

            for (const kr of keyRows || []) {
              const token = kr.litellm_token || kr.key_value;
              const agg = keyAgg[token];
              if (!agg) continue;
              if (!userStats[kr.user_id]) userStats[kr.user_id] = { cost: 0, requests: 0 };
              userStats[kr.user_id].cost += agg.cost;
              userStats[kr.user_id].requests += agg.requests;
            }
          }
        } else {
          console.warn("global/spend/report (api_key) failed:", tagRes.status);
        }

        // Compute totals from modelStats
        for (const s of Object.values(modelStats)) {
          totalCost += s.cost;
          totalTokens += s.tokens;
          totalRequests += s.requests;
        }
      } catch (err) {
        console.error("LiteLLM global/spend/report error:", err);
      }
    }

    // Fallback: if proxy gave nothing, use local token_usage (legacy path)
    if (totalRequests === 0) {
      const { data: usage } = await supabase
        .from("token_usage")
        .select("model, cost_usd, tokens_used, user_id")
        .order("timestamp", { ascending: false })
        .limit(1000);
      for (const row of usage || []) {
        const model = row.model || "unknown";
        const cost = Number(row.cost_usd || 0);
        const tokens = Number(row.tokens_used || 0);
        totalCost += cost;
        totalTokens += tokens;
        totalRequests += 1;
        const st = statFor(model);
        st.cost += cost;
        st.tokens += tokens;
        st.requests += 1;
        if (!userStats[row.user_id]) userStats[row.user_id] = { cost: 0, requests: 0 };
        userStats[row.user_id].cost += cost;
        userStats[row.user_id].requests += 1;
      }
    }

    const topUserIds = Object.entries(userStats)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 10)
      .map(([id]) => id);

    let topUsers: { user_id: string; email: string; full_name: string | null; cost: number; requests: number }[] = [];
    if (topUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", topUserIds);
      topUsers = topUserIds.map((uid) => {
        const p = profiles?.find((pr: any) => pr.id === uid);
        return {
          user_id: uid,
          email: p?.email || "unknown",
          full_name: p?.full_name || null,
          ...userStats[uid],
        };
      });
    }

    const topModels = Object.entries(modelStats)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 15)
      .map(([model, { runtimes, ...stats }]) => ({ model, runtime_models: [...runtimes], ...stats }));

    return json({ totalCost, totalTokens, totalRequests, topModels, topUsers });
  }

  return json({ error: "Invalid type parameter. Use: credits, keys, usage" }, 400);
});
