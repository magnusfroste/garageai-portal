import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildGatewayTargets } from "../../supabase/functions/_shared/gatewayTargets.ts";
import { allUserSpend, parseUserListPage } from "../../supabase/functions/_shared/userSpendList.ts";

const rows: Record<string, unknown[]> = {
  garages: [
    { id: "g1", name: "alpha", port: 11434, connection_type: "mesh", transport: "tunnel", tunnel_ip: "10.66.0.5", tunnel_public_key: "pk", disabled: false, paused_at: null, visibility: "market", last_heartbeat_at: "2026-11-14T00:00:00Z", agent: null, machine_id: "m", last_machine_id: "m" },
    { id: "g2", name: "prov", port: null, connection_type: "endpoint", endpoint_url: "https://api.example.com/v1", transport: "endpoint", disabled: false, paused_at: null, visibility: "market" },
  ],
  garage_runtime_secrets: [{ garage_id: "g2", runtime_api_key: "k" }],
  garage_models: [{ garage_id: "g1", model: "qwen3:8b", context_length: 32768 }],
  onboarding_events: [],
};
const fakeAdmin = () => ({ from: (t: string) => { const q: any = { select: () => q, eq: () => q, in: () => q, not: () => q, order: () => q, limit: () => q, then: (r: any) => r({ data: rows[t] ?? [], error: null }) }; return q; } });

test("health report targets equal gateway-targets for the same data", async () => {
  const fromTargets = await buildGatewayTargets(fakeAdmin());
  const fromHealth = await buildGatewayTargets(fakeAdmin());
  expect(fromHealth).toEqual(fromTargets);
  expect(fromTargets.map((t: any) => [t.garage, t.host, t.port])).toEqual([["alpha", "10.66.0.5", 11434], ["prov", "api.example.com", 443]]);
  const dir = "supabase/functions";
  expect(readFileSync(`${dir}/gateway-targets/index.ts`, "utf8")).toContain("buildGatewayTargets(admin)");
  expect(readFileSync(`${dir}/gateway-health-report/index.ts`, "utf8")).toContain("buildGatewayTargets(admin)");
});

test("user list spend: paged, and users without a numeric spend are left to per-user lookup", async () => {
  expect(parseUserListPage({ users: [{ user_id: "a", spend: 1.5 }, { user_id: "b" }], page: 1, total_pages: 2 })).toEqual({ spend: new Map([["a", 1.5]]), more: true });
  expect(parseUserListPage({ error: "x" })).toBeNull();
  const pages = [{ users: [{ user_id: "a", spend: 1 }], page: 1, total_pages: 2 }, { users: [{ user_id: "c", spend: 2 }], page: 2, total_pages: 2 }];
  let i = 0;
  const f = (async () => new Response(JSON.stringify(pages[i++]))) as unknown as typeof fetch;
  expect(await allUserSpend("http://gw", "k", f)).toEqual(new Map([["a", 1], ["c", 2]]));
  expect(await allUserSpend("http://gw", "k", (async () => new Response("no", { status: 403 })) as unknown as typeof fetch)).toBeNull();
});
