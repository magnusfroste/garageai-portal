import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Returns the secret value of one API key, only to its signed-in owner and only
// while the key is active. The browser keeps it in memory for the session so
// chat requests can go straight to the EU gateway.
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { key_id } = await req.json().catch(() => ({}));
    if (!key_id || typeof key_id !== 'string') {
      return new Response(JSON.stringify({ error: 'key_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: keyRow, error } = await supabase
      .from('api_keys')
      .select('key_value, is_active, user_id')
      .eq('id', key_id)
      .single();

    if (error || !keyRow || keyRow.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'API key not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!keyRow.is_active) {
      return new Response(JSON.stringify({ error: 'This API key is revoked or inactive' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ key_value: keyRow.key_value }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('chat-key-value error:', error instanceof Error ? error.name : 'unknown');
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
