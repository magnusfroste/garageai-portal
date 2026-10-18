import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Privacy-first web search for the chat: receives ONLY a query string, never
// messages. The tool loop runs in the browser; this is just the SearXNG proxy.
// PRIVACY: never log the query or results.
const DEFAULT_SEARXNG = "https://search.liteit.se";
const SEARCH_TIMEOUT_MS = 8_000;
const MAX_RESULTS = 5;
const MAX_CONTENT_CHARS = 300;

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

    const { query } = await req.json().catch(() => ({}));
    const q = typeof query === 'string' ? query.trim().slice(0, 500) : '';
    if (!q) {
      return new Response(JSON.stringify({ error: 'query required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data } = await supabase.from('admin_settings').select('value').eq('key', 'site_settings').maybeSingle();
    const configured = ((data?.value as Record<string, unknown> | null)?.searxng_url as string | undefined)?.trim();
    const base = (configured || DEFAULT_SEARXNG).replace(/\/+$/, '');

    const headers: Record<string, string> = { Accept: 'application/json' };
    const hn = Deno.env.get('SEARXNG_HEADER_NAME');
    const hv = Deno.env.get('SEARXNG_HEADER_VALUE');
    if (hn && hv) headers[hn] = hv;

    const res = await fetch(`${base}/search?q=${encodeURIComponent(q)}&format=json`, {
      headers,
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`search HTTP ${res.status}`);
    const json = await res.json();
    const results = ((json?.results || []) as Array<Record<string, unknown>>).slice(0, MAX_RESULTS).map((r) => ({
      title: String(r.title || r.url || ''),
      url: String(r.url || ''),
      content: String(r.content || '').slice(0, MAX_CONTENT_CHARS),
    }));

    return new Response(JSON.stringify({ results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('web-search error:', error instanceof Error ? error.name : 'unknown');
    return new Response(JSON.stringify({ error: 'Search failed' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
