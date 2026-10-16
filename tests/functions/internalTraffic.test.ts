import { expect, test } from "bun:test";
import { countsAsDemand, internalAlias, taggedInternal } from "../../supabase/functions/_shared/internalTraffic";
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