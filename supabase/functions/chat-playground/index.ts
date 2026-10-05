import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";
import { modelSupportsTools, getSearxngUrl, streamWithWebSearch } from "./webSearch.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages, model, api_key_id, system_prompt, web_search } = await req.json();

    // Determine which key to use
    let apiKeyForRequest: string;

    if (api_key_id) {
      // User selected a specific key — look it up and verify ownership
      const { data: keyRow, error: keyError } = await supabase
        .from('api_keys')
        .select('key_value, is_active, user_id')
        .eq('id', api_key_id)
        .single();

      if (keyError || !keyRow) {
        return new Response(JSON.stringify({ error: 'API key not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (keyRow.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized: key does not belong to you' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!keyRow.is_active) {
        return new Response(JSON.stringify({ error: 'This API key is revoked or inactive' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      apiKeyForRequest = keyRow.key_value;
    } else {
      // Fallback: admin using master key (backwards compatible)
      const { data: hasRole } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin',
      });

      if (!hasRole) {
        return new Response(JSON.stringify({ error: 'No API key selected and not admin' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const LITELLM_MASTER_KEY = Deno.env.get('LITELLM_MASTER_KEY');
      if (!LITELLM_MASTER_KEY) {
        return new Response(JSON.stringify({ error: 'LiteLLM configuration missing' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      apiKeyForRequest = LITELLM_MASTER_KEY;
    }

    // Build messages array with optional system prompt
    const finalMessages = system_prompt
      ? [{ role: 'system', content: system_prompt }, ...messages]
      : messages;

    const proxyBase = await getProxyBaseUrl(supabase);

    if (web_search === true) {
      if (!(await modelSupportsTools(supabase, String(model || '')))) {
        return new Response(JSON.stringify({ error: 'Den här modellen har inte stöd för verktyg' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const searxngUrl = await getSearxngUrl(supabase);
      const stream = streamWithWebSearch({
        proxyBase, apiKey: apiKeyForRequest, model: String(model), messages: finalMessages, searxngUrl,
        signal: req.signal,
      });
      return new Response(stream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      });
    }

    const response = await fetch(`${proxyBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeyForRequest}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: finalMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LiteLLM chat error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Model request failed', details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat playground error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
