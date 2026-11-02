// Recent API requests across all of the caller's own (non-internal) keys in ONE
// paginated gateway query, instead of one get-key-usage call per key.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { fetchRouteMap, publicModelName } from '../_shared/modelNames.ts';
import { getProxyBaseUrl } from '../_shared/proxyConfig.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const MAX_ROWS = 500;
const PAGE = 100;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { data: keys, error } = await admin.from('api_keys').select('name, litellm_token, key_value').eq('user_id', user.id).eq('internal', false);
    if (error) throw error;
    const names = new Map<string, string>();
    for (const k of keys || []) { const id = k.litellm_token || k.key_value; if (id) names.set(id, k.name); }
    if (!names.size) return json({ spend_logs: [] });

    const { data: profile } = await admin.from('profiles').select('litellm_user_id').eq('id', user.id).single();
    const base = await getProxyBaseUrl(admin);
    const headers = { Authorization: `Bearer ${Deno.env.get('LITELLM_MASTER_KEY') ?? ''}` };
    const day = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
    const t0 = Date.now();
    const routesP = fetchRouteMap(base, headers.Authorization.slice(7));
    const rows: Array<Record<string, unknown>> = [];
    for (let page = 1; rows.length < MAX_ROWS; page++) {
      const q = new URLSearchParams({ user_id: profile?.litellm_user_id || user.id, start_date: day(-30), end_date: day(1), page: String(page), page_size: String(PAGE), sort_by: 'startTime', sort_order: 'desc', exclude_internal_health_checks: 'true' });
      const r = await fetch(`${base}/spend/logs/v2?${q}`, { headers, signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(`spend/logs/v2 ${r.status}`);
      const body = await r.json();
      const batch = (body.data ?? body.response ?? []) as Array<Record<string, unknown>>;
      rows.push(...batch);
      if (batch.length < PAGE) break;
    }
    const routes = await routesP;
    const publicNames = new Set(routes.values());
    const spend_logs = rows
      .filter((l) => names.has(String(l.api_key)))
      .slice(0, MAX_ROWS)
      .map((l) => {
        const name = publicModelName(l.model_group, l.model, routes, publicNames);
        const { metadata: _m, messages: _x, response: _y, proxy_server_request: _p, api_key, ...rest } = l;
        return { ...rest, model: name, model_group: name, key_name: names.get(String(api_key)) };
      });
    console.log('get-request-logs', JSON.stringify({ rows: rows.length, returned: spend_logs.length, ms: Date.now() - t0 }));
    return json({ spend_logs });
  } catch (e) {
    console.error('get-request-logs failed', e);
    return json({ error: 'logs_unavailable' }, 502);
  }
});
