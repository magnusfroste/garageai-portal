import { describe, expect, it, mock } from 'bun:test';
mock.module('https://esm.sh/@supabase/supabase-js@2.45.0', () => ({ createClient: () => null }));
const { reconcileGarageRouting, reconcilePrivateGarage, isModelSellable } = await import('../../supabase/functions/_shared/garageRouting');
import { isPrivateDeployment } from '../../supabase/functions/_shared/privateMachines';
import { garageOfDeploymentId } from '../../supabase/functions/_shared/autoRoute';
import { countsAsDemand } from '../../supabase/functions/_shared/internalTraffic';
import { modelIdError } from '../../supabase/functions/_shared/modelValidation';
const g = { id: 'g1', name: 'garage-m4', operator_id: 'owner', api_host: null, mesh_ip: '10.66.0.4', port: 8080, runtime: 'xyntetik', models: ['granite-4.1-3b-Q8_0.gguf'], connection_type: 'mesh', status: 'failed_test', disabled: false, paused_at: null, visibility: 'market', last_heartbeat_at: null, pool_input_cost_per_million: 1, pool_output_cost_per_million: 2, dedicated_input_cost_per_million: 3, dedicated_output_cost_per_million: 4 } as const;
function admin() {
  return { from(table: string) {
    let settings = false;
    const result = () => ({ data: settings ? { value: { internal_api_base_url: 'https://llm.garageai.eu' } } : table === 'garage_models' ? [{ garage_id: 'g1', model: g.models[0], canonical_model: 'ibm-granite/granite-4.1-3b', context_length: 8192 }] : table === 'garage_runtime_secrets' ? [{ garage_id: 'g1', runtime_api_key: 'runtime-test-key' }] : [], error: null });
    const q: Record<string, unknown> = {};
    for (const method of ['select','in','not','order','limit','update','upsert']) q[method] = () => q;
    q.eq = (key: string, value: string) => { if (key === 'key' && value === 'site_settings') settings = true; return q; };
    q.maybeSingle = async () => result();
    q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return q;
  }};
}
function gateway() {
  (globalThis as { Deno?: unknown }).Deno = { env: { get: () => 'test-master' } };
  const deps = new Map<string, any>();
  globalThis.fetch = mock(async (url: any, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    if (String(url).endsWith('/model/info')) return Response.json({ data: [...deps.values()] });
    if (String(url).endsWith('/model/new')) deps.set(body.model_info.id, body);
    if (String(url).endsWith('/model/delete')) deps.delete(body.id);
    return Response.json({});
  }) as typeof fetch;
  return deps;
}
describe('My machine routing', () => {
  it('creates before tests/offers and removes on the next empty heartbeat', async () => {
    const deps = gateway();
    await reconcilePrivateGarage(admin() as never, g as never, { [g.models[0]]: 16384 });
    const d = [...deps.values()][0];
    expect(d.model_name).toBe('mine/garage-m4/ibm-granite/granite-4.1-3b');
    expect(d.model_info).toMatchObject({ garage_tier: 'private', operator_id: 'owner', connection_type: 'mesh', max_input_tokens: 16384, max_tokens: 16384 });
    expect(d.litellm_params).toMatchObject({ model: 'openai/granite-4.1-3b-Q8_0.gguf', api_base: 'http://10.66.0.4:8080/v1', api_key: 'runtime-test-key', input_cost_per_token: 0, output_cost_per_token: 0, cache_read_input_token_cost: 0 });
    expect(d.model_info.member_auto_router).toBeUndefined();
    await reconcilePrivateGarage(admin() as never, { ...g, models: [] } as never);
    expect(deps.size).toBe(0);
  });
  it('keeps the private deployment when paused in the portal', async () => {
    const deps = gateway();
    await reconcileGarageRouting(admin() as never, [{ ...g, paused_at: '2026-10-20T20:00:00Z' }] as never, new Set(), new Set());
    expect([...deps.values()].map(d => d.model_name)).toEqual(['mine/garage-m4/ibm-granite/granite-4.1-3b']);
  });
  it('Only me removes existing market deployments even when sellable and enabled', async () => {
    const deps = gateway();
    deps.set('garage-m4__granite__pool', { model_name: 'ibm-granite/granite', model_info: { id: 'garage-m4__granite__pool', garage: g.name, garage_tier: 'pool' } });
    await reconcileGarageRouting(admin() as never, [{ ...g, visibility: 'private' }] as never, new Set([`${g.name}::${g.models[0]}`]), new Set(['garage-m4__granite__pool']));
    expect([...deps.values()].every(isPrivateDeployment)).toBe(true);
    expect(deps.size).toBe(1);
    expect(isModelSellable({ ...g, visibility: 'private' } as never, g.models[0], { passed: true, tested_at: Date.now() })).toBe(false);
  });
  it('owner usage never contributes to demand, revenue or market quality', () => {
    expect(countsAsDemand({ model: 'mine/garage-m4/ibm-granite/granite-4.1-3b' }, new Set())).toBe(false);
    expect(countsAsDemand({ model_id: 'garage-m4__granite__private' }, new Set())).toBe(false);
    expect(garageOfDeploymentId('garage-m4__granite__private')).toBeNull();
    expect(modelIdError('mine/garage-m4/granite', true)).not.toBeNull();
  });
});