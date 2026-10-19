import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { resolveUserBudget } from "../_shared/userBudget.ts";

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
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('litellm_user_id, starting_credit_usd, purchased_credits_usd')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) throw new Error('Profile not found');

    if (!profile?.litellm_user_id) {
      return new Response(JSON.stringify(resolveUserBudget(profile)), {
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
      return new Response(JSON.stringify(resolveUserBudget(profile)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const litellmData = await litellmResponse.json();
    const userInfo = litellmData.user_info || litellmData;

    return new Response(JSON.stringify(resolveUserBudget(profile, userInfo)), {
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
