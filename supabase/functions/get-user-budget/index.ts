import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LITELLM_MASTER_KEY = Deno.env.get('LITELLM_MASTER_KEY') || '';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get litellm_user_id from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('litellm_user_id, starting_credit_usd, purchased_credits_usd')
      .eq('id', user.id)
      .single();

    if (!profile?.litellm_user_id) {
      return new Response(JSON.stringify({
        max_budget: 0,
        spend: 0,
        budget_remaining: 0,
        purchased_credits_usd: profile?.purchased_credits_usd ?? 0,
        litellm_user_id: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user info from LiteLLM
    const proxyBase = await getProxyBaseUrl(supabase);
    const url = new URL(`${proxyBase}/user/info`);
    url.searchParams.set('user_id', profile.litellm_user_id);

    const litellmResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!litellmResponse.ok) {
      console.error('LiteLLM /user/info error:', litellmResponse.status);
      const configuredBudget = Number(profile.starting_credit_usd ?? 0) + Number(profile.purchased_credits_usd ?? 0);
      return new Response(JSON.stringify({
        max_budget: configuredBudget,
        spend: 0,
        budget_remaining: configuredBudget,
        purchased_credits_usd: profile.purchased_credits_usd ?? 0,
        litellm_user_id: profile.litellm_user_id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const litellmData = await litellmResponse.json();
    const userInfo = litellmData.user_info || litellmData;

    const maxBudget = Number(userInfo.max_budget ?? 0);
    const spend = Number(userInfo.spend ?? 0);

    return new Response(JSON.stringify({
      max_budget: maxBudget,
      spend: spend,
      budget_remaining: maxBudget - spend,
      purchased_credits_usd: profile.purchased_credits_usd ?? 0,
      litellm_user_id: profile.litellm_user_id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching user budget:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
