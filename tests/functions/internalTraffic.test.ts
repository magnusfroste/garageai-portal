import { expect, test } from "bun:test";
import { countsAsDemand, internalAlias, taggedInternal, fingerprint, loadInternalIdentities } from "../../supabase/functions/_shared/internalTraffic";
test("a model with only internal requests has zero demand", () => {
  const rows = [{ model: "openai/gpt-oss-20b", api_key: "gateway" }, { model: "openai/gpt-oss-20b", key_alias: "ops-chain" }, { model: "openai/gpt-oss-20b", key_alias: "test-one" }];
  expect(rows.filter(r => countsAsDemand(r, new Set(["gateway"]))).length).toBe(0);
});
test("test, probe and ops aliases are internal, ordinary buyer keys are not", () => {
  for (const alias of ["test-one", "Probe2", "ops-chain"]) expect(internalAlias(alias)).toBe(true);
  expect(countsAsDemand({ api_key: "buyer", key_alias: "production" }, new Set(["gateway"]))).toBe(true);
});
test("acceptance tests and admin measurements stay internal even with serialized metadata", () => {
  expect(taggedInternal({ metadata: JSON.stringify({ tags: ["acceptance-test"] }) })).toBe(true);
  expect(taggedInternal({ metadata: { tags: ["admin-measurement"] } })).toBe(true);
});
test("gateway and acceptance key fingerprints are internal without calling key/info", async () => {
  const saved: any[] = [];
  const admin = { from: (table: string) => ({
    select: () => table === "api_keys" ? Promise.resolve({ data: [], error: null }) : { eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) },
    upsert: async (records: any[]) => { saved.push(...records); return { error: null }; },
  }) };
  const hash = await fingerprint("gateway-test-fixture");
  const identities = await loadInternalIdentities(admin, "http://unused.invalid", "gateway-test-fixture", [{ api_key: hash }]);
  expect(countsAsDemand({ api_key: hash }, identities)).toBe(false);
  expect(saved.some(r => r.internal && r.alias === "gateway / acceptance-test")).toBe(true);
});