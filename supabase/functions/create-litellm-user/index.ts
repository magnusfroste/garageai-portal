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

    if (!LITELLM_MASTER_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Missing configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Check if user already has a LiteLLM user
    const { data: profile } = await supabase
      .from('profiles')
      .select('litellm_user_id')
      .eq('id', user.id)
      .single();

    if (profile?.litellm_user_id) {
      return new Response(JSON.stringify({ 
        success: true, 
        litellm_user_id: profile.litellm_user_id,
        message: 'LiteLLM user already exists' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read default budget from admin_settings
    const { data: budgetSetting } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'default_user_budget_usd')
      .single();

    const defaultBudget = budgetSetting ? Number(budgetSetting.value) : 25;

    // Create LiteLLM internal user with configured budget
    const proxyBase = await getProxyBaseUrl(supabase);
    const litellmResponse = await fetch(`${proxyBase}/user/new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user.id,
        user_email: user.email,
        max_budget: defaultBudget,
        user_role: 'internal_user',
      }),
    });

    const litellmData = await litellmResponse.json();
    console.log('LiteLLM /user/new response:', { status: litellmResponse.status, user_id: litellmData?.user_id });

    let litellmUserId: string;

    if (litellmResponse.ok) {
      litellmUserId = litellmData.user_id || user.id;
    } else if (litellmResponse.status === 409) {
      // User already exists in LiteLLM — fetch their info instead
      console.log('LiteLLM user already exists, fetching info...');
      const infoUrl = new URL(`${proxyBase}/user/info`);
      infoUrl.searchParams.set('user_id', user.id);

      const infoRes = await fetch(infoUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (infoRes.ok) {
        const infoData = await infoRes.json();
        litellmUserId = infoData.user_info?.user_id || user.id;
      } else {
        // Fallback: use the Supabase user ID as the LiteLLM user ID
        litellmUserId = user.id;
      }
    } else {
      throw new Error(litellmData.error?.message || `LiteLLM error: ${litellmResponse.status}`);
    }

    // Store LiteLLM user ID in profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ litellm_user_id: litellmUserId })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update profile with litellm_user_id:', updateError);
      throw new Error('Failed to save LiteLLM user ID');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      litellm_user_id: litellmUserId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating LiteLLM user:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
