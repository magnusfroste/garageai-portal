import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LiteLLMModelInfo {
  model_name: string;
  litellm_params?: {
    model?: string;
  };
  model_info?: {
    id?: string;
    max_tokens?: number;
    max_input_tokens?: number;
    max_output_tokens?: number;
    input_cost_per_token?: number;
    output_cost_per_token?: number;
    mode?: string;
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LITELLM_MASTER_KEY = Deno.env.get('LITELLM_MASTER_KEY');
    if (!LITELLM_MASTER_KEY) {
      return new Response(JSON.stringify({ error: 'LiteLLM configuration missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeaders = { 'Authorization': `Bearer ${LITELLM_MASTER_KEY}` };

    const LITELLM_BASE = await getProxyBaseUrl();

    const modelsRes = await fetch(`${LITELLM_BASE}/model/info`, { headers: authHeaders });

    if (!modelsRes.ok) {
      console.error('LiteLLM /model/info error:', modelsRes.status);
      return new Response(JSON.stringify({ error: 'Failed to fetch models' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Status comes from curated_models (set by sync-models) — never probe models here
    const statusById = new Map<string, string>();
    const statusByName = new Map<string, string>();
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (SUPABASE_URL && SERVICE_KEY) {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: rows, error } = await admin.from('curated_models').select('id, model_name, status');
      if (error) console.warn('Could not read curated_models status:', error.message);
      for (const r of (rows || []) as Array<{ id: string; model_name: string | null; status: string }>) {
        statusById.set(r.id, r.status);
        if (r.model_name && !statusByName.has(r.model_name)) statusByName.set(r.model_name, r.status);
      }
    }

    const data = await modelsRes.json();
    const rawModels: LiteLLMModelInfo[] = data.data || [];

    const models = rawModels.map((m) => {
      const info = m.model_info || {};
      const litellmModel = m.litellm_params?.model || m.model_name;
      const providerRaw = litellmModel.includes('/')
        ? litellmModel.split('/')[0]
        : 'unknown';
      const provider = providerRaw.charAt(0).toUpperCase() + providerRaw.slice(1);

      const healthStatus = statusById.get(info.id || '')
        || statusById.get(m.model_name)
        || statusByName.get(m.model_name)
        || null;

      return {
        id: m.model_name,
        provider,
        max_input_tokens: info.max_input_tokens || info.max_tokens || null,
        max_output_tokens: info.max_output_tokens || null,
        input_cost_per_million: info.input_cost_per_token
          ? Math.round(info.input_cost_per_token * 1_000_000 * 1000) / 1000
          : null,
        output_cost_per_million: info.output_cost_per_token
          ? Math.round(info.output_cost_per_token * 1_000_000 * 1000) / 1000
          : null,
        cache_read_cost_per_million: info.cache_read_input_token_cost != null
          ? Math.round(info.cache_read_input_token_cost * 1e6 * 1e6) / 1e6
          : null,
        mode: info.mode || null,
        status: healthStatus || 'unknown',
        litellmModel,
      };
    });

    // Remove temp field and sort
    const result = models
      .map(({ litellmModel, ...rest }) => rest)
      .sort((a, b) => {
        const order: Record<string, number> = { healthy: 0, unknown: 1, unhealthy: 2 };
        const diff = (order[a.status] ?? 1) - (order[b.status] ?? 1);
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      });

    return new Response(JSON.stringify({ models: result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in list-models:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
