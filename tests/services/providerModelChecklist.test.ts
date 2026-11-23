import { expect, test } from "bun:test";
import { buildChecklist } from "../../src/models/services/providerModelChecklist";

test("an offered model keeps its stored prices over the endpoint's", () => {
  const rows = buildChecklist([{ id: "a/x", input: 9, output: 9, cache_read: 1, context: 1000 }], [{ model: "a/x", offered: true, pool_input_cost_per_million: 0.5, pool_output_cost_per_million: 2 }], ["a/x"]);
  expect(rows[0]).toMatchObject({ id: "a/x", offered: true, input: 0.5, output: 2, cache_read: 1, context: 1000 });
});

test("unlisted offered models stay visible and come first; unticked rows are not offered", () => {
  const rows = buildChecklist([{ id: "b/y", input: null, output: null, cache_read: null, context: null }], [{ model: "z/manual", offered: true }, { model: "b/y", offered: false }], ["z/manual"]);
  expect(rows.map((r) => [r.id, r.offered, r.listed])).toEqual([["z/manual", true, false], ["b/y", false, true]]);
});
