import { afterEach, expect, mock, test } from "bun:test";
mock.module("https://esm.sh/@supabase/supabase-js@2.45.0", () => ({ createClient: () => null }));
const originalFetch = globalThis.fetch;
const originalDeno = (globalThis as { Deno?: unknown }).Deno;
afterEach(() => { globalThis.fetch = originalFetch; (globalThis as { Deno?: unknown }).Deno = originalDeno; });

async function connectivity(signal: { last_gateway_check_at: string | null; runtime_ok: boolean | null; mesh_connected: boolean | null }) {
  (globalThis as { Deno?: unknown }).Deno = { env: { get: () => "test-key" } };
  const provider = { id: "p", name: "provider", connection_type: "endpoint", transport: "tunnel", models: [], disabled: false, ...signal };
  const admin = { from(table: string) {
    let settings = false;
    const q: Record<string, unknown> = {};
    const result = () => ({ data: settings ? { value: { internal_api_base_url: "https://gateway.fixture" } } : table === "garages" ? [provider] : [], error: null });
    for (const method of ["select","in","not","order","limit","update","upsert","delete","neq"]) q[method] = () => q;
    q.eq = (key: string, value: unknown) => { if (key === "key" && value === "site_settings") settings = true; return q; };
    q.maybeSingle = async () => result();
    q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return q;
  } };
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return Response.json({ data: [{ model_name: "provider-model", model_info: { id: "provider__m__dedicated", garage: "provider" } }], total_pages: 1 });
  }) as typeof fetch;
  const { syncModels } = await import("../../supabase/functions/_shared/syncModels");
  const result = await syncModels(admin as never, { checkNonGarageHealth: false, enableNewGarageModels: false });
  expect(calls.some(url => url.includes("/peers"))).toBe(false);
  return result.garageConnectivity.provider;
}

test("endpoint without gateway signal retains recent-test health despite tunnel metadata", async () => {
  expect(await connectivity({ last_gateway_check_at: null, runtime_ok: null, mesh_connected: null })).toBe("healthy");
});
test("endpoint explicit gateway failure stays unhealthy", async () => {
  expect(await connectivity({ last_gateway_check_at: "2026-11-07T19:00:00Z", runtime_ok: false, mesh_connected: null })).toBe("unhealthy");
});
test("endpoint null tunnel signal with healthy runtime retains existing interpretation", async () => {
  expect(await connectivity({ last_gateway_check_at: "2026-11-07T19:00:00Z", runtime_ok: true, mesh_connected: null })).toBe("healthy");
});