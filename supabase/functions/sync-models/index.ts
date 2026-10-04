import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";
import { getNetbirdApiUrl, netbirdHeaders } from "../_shared/netbirdConfig.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LiteLLMModelInfo {
  model_name: string;
  litellm_params?: { model?: string };
  model_info?: {
    id?: string;
    max_tokens?: number;
    max_input_tokens?: number;
    max_output_tokens?: number;
    input_cost_per_token?: number;
    output_cost_per_token?: number;
    mode?: string;
    garage?: string;
    garage_tier?: string;
  };
}

interface HealthEntry {
  model: string;
  status: string;
}

/**
 * Try individual model health check with a short timeout.
 * LiteLLM supports /health?model=<model_name> for per-model checks.
 */
async function checkModelHealth(
  base: string,
  modelName: string,
  authHeaders: Record<string, string>,
  timeoutMs = 8000
): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(
      `${base}/health?model=${encodeURIComponent(modelName)}`,
      { headers: authHeaders, signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text();
      console.warn(`Health check for ${modelName} returned ${res.status}: ${body}`);
      return 'unknown';
    }

    const data = await res.json();
    // /health?model=X returns { healthy_endpoints: [...], unhealthy_endpoints: [...] }
    const healthy: HealthEntry[] = data.healthy_endpoints || [];
    const unhealthy: HealthEntry[] = data.unhealthy_endpoints || [];

    if (unhealthy.length > 0) return 'unhealthy';
    if (healthy.length > 0) return 'healthy';
    return 'unknown';
  } catch (err) {
    console.warn(`Health check timeout/error for ${modelName}:`, err);
    return 'unknown';
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LITELLM_MASTER_KEY = Deno.env.get('LITELLM_MASTER_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LITELLM_MASTER_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Configuration missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is admin (mandatory)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseAnon = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || '');
    {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAnon.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const supabaseAdminCheck = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: hasRole } = await supabaseAdminCheck.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!hasRole) {
        return new Response(JSON.stringify({ error: 'Admin required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const authHeaders = { 'Authorization': `Bearer ${LITELLM_MASTER_KEY}` };
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const LITELLM_BASE = await getProxyBaseUrl(supabaseAdmin);

    // Fetch models (no global /health — it runs real completions on every model)
    const modelsRes = await fetch(`${LITELLM_BASE}/model/info`, { headers: authHeaders });

    if (!modelsRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch models from LiteLLM' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await modelsRes.json();
    const rawModels: LiteLLMModelInfo[] = data.data || [];

    const supabase = supabaseAdmin;
    const now = new Date().toISOString();

    // Get existing models to preserve enabled state and huggingface_url.
    // Match by both `id` AND `model_name` so we carry settings forward even if
    // LiteLLM's internal id changed (e.g. after a redeploy).
    const { data: existing } = await supabase
      .from('curated_models')
      .select('id, model_name, enabled, huggingface_url, is_default');
    type ExistingRow = { id: string; model_name: string | null; enabled: boolean; huggingface_url: string | null; is_default: boolean };
    const existingById = new Map<string, ExistingRow>();
    const existingByName = new Map<string, ExistingRow>();
    for (const row of (existing || []) as ExistingRow[]) {
      existingById.set(row.id, row);
      // Prefer rows that actually have settings set when multiple share a name
      const nameKey = row.model_name || row.id;
      const prev = existingByName.get(nameKey);
      if (!prev || (!prev.enabled && row.enabled) || (!prev.is_default && row.is_default)) {
        existingByName.set(nameKey, row);
      }
    }

    // Garage connectivity from NetBird (fetched once; never probe garage GPUs via LiteLLM)
    const garageNames = new Set<string>();
    for (const m of rawModels) {
      const g = m.model_info?.garage;
      if (typeof g === 'string' && g) garageNames.add(g);
    }
    let peerConnected: Map<string, boolean> | null = null;
    if (garageNames.size > 0) {
      try {
        const nbUrl = await getNetbirdApiUrl(supabaseAdmin);
        const res = await fetch(`${nbUrl}/peers`, { headers: netbirdHeaders() });
        if (!res.ok) throw new Error(`NetBird GET /peers status ${res.status}`);
        const peers = (await res.json()) as Array<{ name?: string; connected?: boolean }>;
        peerConnected = new Map();
        for (const p of peers) {
          if (p.name && p.connected === true) peerConnected.set(p.name, true);
        }
      } catch (e) {
        console.warn('NetBird peer lookup failed; garage status unknown:', e instanceof Error ? e.message : 'error');
        peerConnected = null;
      }
    }
    const garageStatus = (g: string): string =>
      peerConnected === null ? 'unknown' : peerConnected.get(g) ? 'healthy' : 'unhealthy';

    const modelsWithStatus = rawModels.map((m) => {
      const info = m.model_info || {};
      const litellmModel = m.litellm_params?.model || m.model_name;
      const garage = typeof info.garage === 'string' && info.garage ? info.garage : null;
      const garage_tier = garage && typeof info.garage_tier === 'string' ? info.garage_tier : null;
      let provider: string;
      if (garage) {
        provider = garage;
      } else {
        const providerRaw = litellmModel.includes('/') ? litellmModel.split('/')[0] : 'unknown';
        provider = providerRaw.charAt(0).toUpperCase() + providerRaw.slice(1);
      }
      const stableId = info.id || m.model_name;
      const prev = existingById.get(stableId) || existingByName.get(m.model_name);

      return {
        id: stableId,
        model_name: m.model_name,
        provider,
        garage,
        garage_tier,
        litellmModel,
        max_input_tokens: info.max_input_tokens || info.max_tokens || null,
        max_output_tokens: info.max_output_tokens || null,
        input_cost_per_million: info.input_cost_per_token !== null && info.input_cost_per_token !== undefined
          ? Math.round(info.input_cost_per_token * 1_000_000 * 1000) / 1000
          : null,
        output_cost_per_million: info.output_cost_per_token !== null && info.output_cost_per_token !== undefined
          ? Math.round(info.output_cost_per_token * 1_000_000 * 1000) / 1000
          : null,
        mode: info.mode || null,
        status: garage ? garageStatus(garage) : 'unknown',
        enabled: prev?.enabled ?? false,
        is_default: prev?.is_default ?? false,
        huggingface_url: prev?.huggingface_url ?? null,
        last_synced_at: now,
        updated_at: now,
      };
    });

    // Per-model health checks for non-garage models only, in parallel
    const nonGarage = modelsWithStatus.filter((m) => !m.garage);
    if (nonGarage.length > 0) {
      const checks = await Promise.all(
        nonGarage.map(async (m) => ({ id: m.id, status: await checkModelHealth(LITELLM_BASE, m.model_name, authHeaders) }))
      );
      const checkMap = new Map(checks.map((c) => [c.id, c.status]));
      for (const m of modelsWithStatus) {
        if (!m.garage && checkMap.has(m.id)) m.status = checkMap.get(m.id)!;
      }
    }

    // Update garages.status from NetBird connectivity (skip if NetBird failed)
    if (peerConnected !== null) {
      for (const g of garageNames) {
        const { error: gErr } = await supabase
          .from('garages')
          .update({ status: peerConnected.get(g) ? 'online' : 'offline' })
          .eq('name', g);
        if (gErr) console.warn(`Failed to update garage status for ${g}:`, gErr.message);
      }
    }

    // Remove the temporary litellmModel field before upsert
    const modelsToUpsert = modelsWithStatus.map(({ litellmModel, ...rest }) => rest);

    const { error: upsertError } = await supabase
      .from('curated_models')
      .upsert(modelsToUpsert, { onConflict: 'id' });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return new Response(JSON.stringify({ error: 'Failed to save models' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete rows that no longer exist in LiteLLM
    const liveIds = new Set(modelsToUpsert.map((m) => m.id));
    const staleIds = (existing || [])
      .map((row) => row.id)
      .filter((id) => !liveIds.has(id));

    let deleted = 0;
    if (staleIds.length > 0) {
      const { error: deleteError, count } = await supabase
        .from('curated_models')
        .delete({ count: 'exact' })
        .in('id', staleIds);
      if (deleteError) {
        console.error('Delete error:', deleteError);
      } else {
        deleted = count ?? staleIds.length;
        console.log(`Deleted ${deleted} stale models:`, staleIds);
      }
    }

    const healthSummary = modelsToUpsert.reduce((acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return new Response(JSON.stringify({ synced: modelsToUpsert.length, deleted, health: healthSummary }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in sync-models:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
