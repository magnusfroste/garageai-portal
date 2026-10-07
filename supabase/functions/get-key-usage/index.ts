import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchRouteMap, publicModelName } from '../_shared/modelNames.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


interface KeyUsageResponse {
  info: {
    key_name: string;
    key_alias: string;
    spend: number;
    max_budget: number;
    budget_remaining: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    models: string[];
    expires: string;
    metadata: Record<string, unknown>;
  };
  spend_logs?: Array<{
    request_id: string;
    startTime: string;
    model: string;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    spend: number;
    status: string;
  }>;
  daily_breakdown?: Array<{
    date: string;
    spend: number;
    total_tokens: number;
    api_requests: number;
    models?: Array<{
      model: string;
      spend: number;
      total_tokens: number;
      api_requests: number;
    }>;
  }>;
}

/**
 * /user/daily/activity returns server-side aggregated spend per day, model, and api_key.
 * Designed to scale to 1M+ spend logs (PR #9603 in LiteLLM).
 * Filtering by api_key happens server-side so we transfer ~kilobytes instead of megabytes.
 */
async function fetchDailyActivity(base: string, litellmToken: string, masterKey: string) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30); // last 30 days
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const url = `${base}/user/daily/activity?api_key=${encodeURIComponent(litellmToken)}&start_date=${fmt(start)}&end_date=${fmt(end)}&page_size=100`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${masterKey}` },
  });
  if (!res.ok) {
    const body = await res.text();
    console.warn('daily/activity failed:', res.status, body.slice(0, 200));
    return null;
  }
  return await res.json();
}

/**
 * /spend/logs filtered server-side by api_key for the recent-requests list.
 * Limited result set (small page) so this stays fast.
 */
async function fetchRecentLogs(base: string, litellmToken: string, masterKey: string, limit = 50) {
  const url = `${base}/spend/logs?api_key=${encodeURIComponent(litellmToken)}&page_size=${limit}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${masterKey}` },
  });
  if (!res.ok) {
    console.warn('spend/logs failed:', res.status);
    return [];
  }
  const data = await res.json();
  const arr = Array.isArray(data) ? data : (data.response || data.data || []);
  return arr
    .filter((log: { api_key?: string }) => !log.api_key || log.api_key === litellmToken)
    .slice(0, limit);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const litellmMasterKey = Deno.env.get('LITELLM_MASTER_KEY') || '';

    if (!litellmMasterKey) {
      throw new Error('LITELLM_MASTER_KEY is not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { keyId } = await req.json();
    if (!keyId) {
      return new Response(JSON.stringify({ error: 'keyId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: apiKeyData, error: keyError } = await supabase
      .from('api_keys')
      .select('key_value, litellm_token, user_id, name')
      .eq('id', keyId)
      .single();

    if (keyError || !apiKeyData) {
      return new Response(JSON.stringify({ error: 'API key not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (apiKeyData.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized access to key' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyIdentifier = apiKeyData.litellm_token || apiKeyData.key_value;

    const LITELLM_BASE = await getProxyBaseUrl(supabase);

    // Fetch key info, daily activity, and recent logs in parallel
    const [keyInfoRes, dailyData, rawLogs, routeMap] = await Promise.all([
      fetch(`${LITELLM_BASE}/key/info?key=${keyIdentifier}`, {
        headers: { 'Authorization': `Bearer ${litellmMasterKey}` },
      }),
      fetchDailyActivity(LITELLM_BASE, keyIdentifier, litellmMasterKey),
      fetchRecentLogs(LITELLM_BASE, keyIdentifier, litellmMasterKey, 50),
      fetchRouteMap(LITELLM_BASE, litellmMasterKey),
    ]);
    const publicNames = new Set(routeMap.values());
    const recentLogs = (rawLogs as Array<Record<string, unknown>>).map((log) => {
      const name = publicModelName(log.model_group, log.model, routeMap, publicNames);
      return { ...log, model: name, model_group: name };
    });

    if (!keyInfoRes.ok) {
      if (keyInfoRes.status === 404) {
        return new Response(JSON.stringify({
          info: {
            key_name: apiKeyData.name,
            key_alias: apiKeyData.name,
            spend: 0, max_budget: 0, budget_remaining: 0,
            total_tokens: 0, prompt_tokens: 0, completion_tokens: 0,
            models: [], expires: '', metadata: {},
          },
          spend_logs: [],
          daily_breakdown: [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const errText = await keyInfoRes.text();
      console.error('LiteLLM key/info error:', keyInfoRes.status, errText.slice(0, 200));
      return new Response(JSON.stringify({ error: 'Failed to fetch key info' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawKeyInfo = await keyInfoRes.json();
    const keyInfo = rawKeyInfo.info || rawKeyInfo;

    // Pull aggregated totals from daily/activity metadata when available — much
    // more accurate than older /key/info which sometimes omits token counts.
    const aggMeta = dailyData?.metadata || {};
    const aggregatedTotalTokens = aggMeta.total_tokens ?? 0;
    const aggregatedPromptTokens = aggMeta.total_prompt_tokens ?? 0;
    const aggregatedCompletionTokens = aggMeta.total_completion_tokens ?? 0;
    const aggregatedSpend = aggMeta.total_spend ?? 0;

    const spend = keyInfo.spend ?? keyInfo.total_spend ?? aggregatedSpend ?? 0;
    const maxBudget = keyInfo.max_budget ?? keyInfo.budget_limit ?? 0;
    const totalTokens = keyInfo.total_tokens ?? aggregatedTotalTokens;
    const promptTokens = keyInfo.prompt_tokens ?? aggregatedPromptTokens;
    const completionTokens = keyInfo.completion_tokens ?? aggregatedCompletionTokens;

    // Build a compact daily breakdown for charts (incl. per-model split)
    type LitellmDayResult = {
      date: string;
      metrics?: { spend?: number; total_tokens?: number; api_requests?: number };
      breakdown?: {
        models?: Record<string, { metrics?: { spend?: number; total_tokens?: number; api_requests?: number } }>;
        model_groups?: Record<string, { metrics?: { spend?: number; total_tokens?: number; api_requests?: number } }>;
      };
    };
    const dailyBreakdown = Array.isArray(dailyData?.results)
      ? (dailyData.results as LitellmDayResult[])
          .map((r) => ({
            date: r.date,
            spend: r.metrics?.spend ?? 0,
            total_tokens: r.metrics?.total_tokens ?? 0,
            api_requests: r.metrics?.api_requests ?? 0,
            models: Object.entries(
              r.breakdown?.model_groups && Object.keys(r.breakdown.model_groups).length
                ? r.breakdown.model_groups
                : r.breakdown?.models || {},
            ).map(([model, v]) => ({
              model: r.breakdown?.model_groups && Object.keys(r.breakdown.model_groups).length
                ? model
                : publicModelName(null, model, routeMap, publicNames),
              spend: v.metrics?.spend ?? 0,
              total_tokens: v.metrics?.total_tokens ?? 0,
              api_requests: v.metrics?.api_requests ?? 0,
            })),
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];

    const response: KeyUsageResponse = {
      info: {
        key_name: keyInfo.key_name || keyInfo.key_alias || apiKeyData.name,
        key_alias: keyInfo.key_alias || apiKeyData.name,
        spend,
        max_budget: maxBudget,
        budget_remaining: maxBudget ? maxBudget - spend : 0,
        total_tokens: totalTokens,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        models: keyInfo.models || [],
        expires: keyInfo.expires || '',
        metadata: keyInfo.metadata || {},
      },
      spend_logs: recentLogs,
      daily_breakdown: dailyBreakdown,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-key-usage:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
