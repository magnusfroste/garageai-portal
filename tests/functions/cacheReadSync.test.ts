import { afterEach, describe, expect, it, mock } from 'bun:test';
mock.module('https://esm.sh/@supabase/supabase-js@2.45.0', () => ({ createClient: () => null }));
const { reconcileGarageRouting, deploymentId } = await import('../../supabase/functions/_shared/garageRouting');
import type { ModelIdentity, RoutingGarage } from '../../supabase/functions/_shared/garageRouting';

const originalFetch = globalThis.fetch;
const originalDeno = (globalThis as { Deno?: unknown }).Deno;
afterEach(() => {
  globalThis.fetch = originalFetch;
  (globalThis as { Deno?: unknown }).Deno = originalDeno;
});

function fixture() {
  const garage: RoutingGarage = {
    id: 'price-g', name: 'price-garage', operator_id: null,
    api_host: 'fixture', mesh_ip: null, port: 8080, runtime: 'ollama',
    models: ['qwen3:4b'], status: 'online', disabled: false, last_heartbeat_at: null,
    pool_input_cost_per_million: 0.4, pool_output_cost_per_million: 1,
    dedicated_input_cost_per_million: 0.4, dedicated_output_cost_per_million: 1,
    pool_cache_read_cost_per_million: null, dedicated_cache_read_cost_per_million: null,
  };
  const identity = { canonical: 'qwen/qwen3-4b', private: false, context: 8192,
    poolCacheRead: null as number | null, dedicatedCacheRead: null as number | null,
    poolInput: null as number | null, dedicatedInput: null as number | null };
  const identities: ModelIdentity = new Map([[`${garage.id}::${garage.models[0]}`, identity]]);
  type Deployment = { model_info: { id: string; cache_read_input_token_cost: number }; litellm_params: { cache_read_input_token_cost: number } };
  const deployments = new Map<string, Deployment>();
  const writes: unknown[] = [];
  const admin = { from(table: string) {
    let siteSettings = false;
    const result = () => ({ data: siteSettings ? { value: { internal_api_base_url: 'https://llm.garageai.eu' } } : [], error: null });
    const q: Record<string, unknown> = {};
    for (const method of ['select', 'in', 'not', 'order', 'limit']) q[method] = () => q;
    q.update = (value: unknown) => { writes.push({ table, value }); return q; };
    q.eq = (key: string, value: string) => { if (key === 'key' && value === 'site_settings') siteSettings = true; return q; };
    q.maybeSingle = async () => result();
    q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return q;
  } };
  (globalThis as { Deno?: unknown }).Deno = { env: { get: () => 'fixture-master' } };
  globalThis.fetch = mock(async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(url).includes('/model/info')) return Response.json({ data: [...deployments.values()], total_pages: 1 });
    if (String(url).endsWith('/model/new')) {
      const body = JSON.parse(String(init?.body)) as Deployment;
      deployments.set(body.model_info.id, body);
    } else if (String(url).endsWith('/model/delete')) deployments.delete(JSON.parse(String(init?.body)).id);
    else throw new Error(`Unexpected fixture request: ${String(url)}`);
    return Response.json({});
  }) as typeof fetch;
  const sync = () => reconcileGarageRouting(admin as never, [garage], new Set([`${garage.name}::${garage.models[0]}`]),
    new Set(['pool', 'dedicated'].map(tier => deploymentId(garage.name, garage.models[0], tier as 'pool' | 'dedicated'))), identities);
  const cache = (tier: 'pool' | 'dedicated') => Number(deployments.get(deploymentId(garage.name, garage.models[0], tier))?.litellm_params.cache_read_input_token_cost) * 1e6;
  return { garage, identity, deployments, writes, sync, cache };
}

describe('cache-read routing sync', () => {
  it('clearing an override keeps null and pushes the 25% default on the next sync', async () => {
    const f = fixture();
    f.identity.poolCacheRead = f.identity.dedicatedCacheRead = 0.006;
    await f.sync();
    expect(f.cache('pool')).toBeCloseTo(0.006);
    f.identity.poolCacheRead = f.identity.dedicatedCacheRead = null;
    await f.sync();
    expect(f.cache('pool')).toBeCloseTo(0.1);
    expect(f.cache('dedicated')).toBeCloseTo(0.1);
    expect(f.identity.poolCacheRead).toBeNull();
    expect(f.identity.dedicatedCacheRead).toBeNull();
    expect(f.writes).toEqual([]);
  });
  it('changing input moves the default, but retains a real model override', async () => {
    const f = fixture();
    await f.sync();
    expect(f.cache('pool')).toBeCloseTo(0.1);
    f.identity.poolInput = 0.8;
    f.garage.dedicated_input_cost_per_million = 0.8;
    await f.sync();
    expect(f.cache('pool')).toBeCloseTo(0.2);
    expect(f.cache('dedicated')).toBeCloseTo(0.2);
    f.identity.poolCacheRead = 0.006;
    f.identity.poolInput = 1.2;
    await f.sync();
    expect(f.cache('pool')).toBeCloseTo(0.006);
    expect(f.writes).toEqual([]);
  });
  it('never creates an override from a non-default gateway price', async () => {
    const f = fixture();
    await f.sync();
    for (const d of f.deployments.values()) {
      d.model_info.cache_read_input_token_cost = 0.085 / 1e6;
      d.litellm_params.cache_read_input_token_cost = 0.085 / 1e6;
    }
    await f.sync();
    expect(f.cache('pool')).toBeCloseTo(0.1);
    expect(f.cache('dedicated')).toBeCloseTo(0.1);
    expect(f.identity.poolCacheRead).toBeNull();
    expect(f.identity.dedicatedCacheRead).toBeNull();
    expect(f.writes).toEqual([]);
  });
});