import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@4';
import { getProxyBaseUrl } from '../_shared/proxyConfig.ts';
import { activityDates, aggregateKeyActivity } from '../_shared/keyActivity.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: { user }, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => null);
    if (!z.object({}).strict().safeParse(body).success || new URL(req.url).search) return json({ error: 'This endpoint takes no account or key parameters' }, 400);
    const { data: keys, error } = await admin.from('api_keys').select('id, litellm_token, litellm_alias').eq('user_id', user.id).eq('internal', false);
    if (error) throw error;
    const dates = activityDates(new Date());
    const loadedAt = new Date().toISOString();
    if (!keys?.length) return json({ keys: [], loadedAt });
    const { data: profile, error: profileError } = await admin.from('profiles').select('litellm_user_id').eq('id', user.id).single();
    if (profileError) throw profileError;
    const base = await getProxyBaseUrl(admin);
    const masterKey = Deno.env.get('LITELLM_MASTER_KEY');
    if (!masterKey) throw new Error('Gateway access is not configured');
    const headers = { Authorization: `Bearer ${masterKey}` };
    const info = new Map<string, unknown>();
    const infoPromise = Promise.all(keys.map(async key => {
      if (!key.litellm_token) return;
      try {
        const q = new URLSearchParams({ key: key.litellm_token });
        const res = await fetch(`${base}/key/info?${q}`, { headers, signal: AbortSignal.timeout(10000) });
        if (res.ok) info.set(key.id, await res.json());
      } catch { /* Last-used stays unavailable, never falsely "Never". */ }
    }));
    const rows: unknown[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const q = new URLSearchParams({ user_id: profile?.litellm_user_id || user.id, start_date: dates[0], end_date: dates[29], page_size: '100', page: String(page) });
      const res = await fetch(`${base}/user/daily/activity?${q}`, { headers, signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Could not load key consumption (gateway ${res.status})`);
      const payload = await res.json();
      if (!Array.isArray(payload.results)) throw new Error('Gateway returned an invalid activity response');
      rows.push(...payload.results);
      totalPages = Math.max(1, Number(payload.total_pages ?? payload.metadata?.total_pages ?? 1));
      if (!Number.isFinite(totalPages) || totalPages > 100) throw new Error('Gateway returned invalid activity pagination');
      page++;
    } while (page <= totalPages);
    await infoPromise;
    return json({ keys: aggregateKeyActivity(keys, rows, dates, info), loadedAt });
  } catch (e) {
    const message = e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' ? e.message : 'Could not load key activity';
    return json({ error: message }, 502);
  }
});