import { expect, mock, test } from "bun:test";

mock.module("https://esm.sh/@supabase/supabase-js@2.45.0", () => ({ createClient: () => null }));

const SETTINGS = { api_base_url: "https://api.garageai.eu", internal_api_base_url: "https://llm.garageai.eu" };

/** Minimal chainable fake of the service-role client: every query resolves to empty data, site_settings to SETTINGS. */
function fakeAdmin(updates: Array<{ table: string; patch: Record<string, unknown> }>) {
  const builder = (table: string) => {
    let isSettings = false;
    const result = () => ({ data: isSettings ? { value: SETTINGS } : table === "admin_settings" ? null : [], error: null });
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "in", "order", "limit", "neq", "not", "gte", "lte", "or", "upsert", "delete", "insert"]) {
      q[m] = (...args: unknown[]) => { if (m === "eq" && args[0] === "key" && args[1] === "site_settings") isSettings = true; return q; };
    }
    q.update = (patch: Record<string, unknown>) => { updates.push({ table, patch }); return q; };
    q.maybeSingle = async () => result();
    q.single = async () => result();
    q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
    return q;
  };
  return { from: builder, rpc: async () => ({ data: [], error: null }) };
}

test("registerGarage: a tunnel garage registers end to end on the internal gateway host, never NetBird", async () => {
  (globalThis as { Deno?: unknown }).Deno = { env: { get: (k: string) => (k === "LITELLM_MASTER_KEY" ? "mk" : undefined) } };
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("api.garageai.eu")) return new Response("forbidden", { status: 403 }); // public host blocks admin routes
    if (url.includes("/model/info")) return Response.json({ data: [] });
    if (url.includes("/chat/completions")) return Response.json({ choices: [{ message: { content: "OK" } }], usage: { completion_tokens: 2 } });
    return Response.json({});
  }) as typeof fetch;
  const { registerGarage } = await import("../../supabase/functions/_shared/registerGarage");
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = [];
  const garage = { id: "g1", name: "garage-m1", operator_id: "o1", api_host: null, netbird_peer_id: null, dedicated_input_cost_per_million: 0, dedicated_output_cost_per_million: 0, pool_input_cost_per_million: 0, pool_output_cost_per_million: 0, connection_type: "mesh", transport: "tunnel", tunnel_ip: "10.66.0.2" };
  const res = await registerGarage(fakeAdmin(updates) as never, garage, { name: "garage-m1", runtime: "ollama", port: 11434, models: ["qwen3:8b"], mesh_ip: "10.66.0.2" });
  expect(res.api_base).toBe("http://10.66.0.2:11434/v1");
  expect(calls.some((u) => u.includes("api.garageai.eu"))).toBe(false);
  expect(calls.some((u) => u.includes("netbird"))).toBe(false);
  const g = updates.find((u) => u.table === "garages" && "last_registered_at" in u.patch)!;
  expect(g.patch.mesh_ip).toBe("10.66.0.2");
  expect(g.patch.netbird_peer_id).toBeNull();
});
