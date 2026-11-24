import { expect, test } from "bun:test";
import { autoModelOptions, filterAutoModelOptions } from "../../src/models/services/autoRouteService";
import type { CuratedModel } from "../../src/models/types/curatedModel.types";
import type { AutoRouteEntry } from "../../src/models/types/autoRoute.types";

const model = (id: string, name: string, garage: string, patch: Partial<CuratedModel> = {}): CuratedModel => ({
  id, model_name: name, garage, provider: "vendor", enabled: true, status: "healthy", garage_tier: "pool",
  max_input_tokens: 128000, max_output_tokens: 32000, input_cost_per_million: 0.1, output_cost_per_million: 0.3,
  mode: "chat", is_default: false, huggingface_url: null, last_synced_at: "", created_at: "", updated_at: "", ...patch,
});
const entry: AutoRouteEntry = { id: "entry-1", curated_model_id: "a-id", position: 3, enabled: true, note: null, created_at: "" };

test("options sort by model name and search both model and supplier without changing IDs", () => {
  const options = autoModelOptions([model("z-id", "zeta/model", "Sweden"), model("a-id", "alpha/model", "City")], []);
  expect(options.map((o) => o.model.id)).toEqual(["a-id", "z-id"]);
  expect(filterAutoModelOptions(options, "ALPHA city").map((o) => o.model.id)).toEqual(["a-id"]);
  expect(filterAutoModelOptions(options, "sweden").map((o) => o.model.id)).toEqual(["z-id"]);
  expect(filterAutoModelOptions(options, "vendor")).toHaveLength(2);
});

test("already-used entries are visible but disabled, except the row being edited", () => {
  const models = [model("a-id", "alpha/model", "City")];
  expect(autoModelOptions(models, [entry])[0]).toMatchObject({ alreadyInAuto: true, disabled: true });
  expect(autoModelOptions(models, [entry], "entry-1")[0]).toMatchObject({ alreadyInAuto: false, disabled: false });
});

test("down enabled models remain selectable; disabled models remain ineligible", () => {
  const options = autoModelOptions([model("down", "down", "City", { status: "unhealthy" }), model("off", "off", "City", { enabled: false })], []);
  expect(options[0]).toMatchObject({ down: true, disabled: false });
  expect(options[1]).toMatchObject({ down: true, disabled: true });
});

test("picker excludes Auto and non-garage rows, preserving the old candidate scope", () => {
  expect(autoModelOptions([model("garageai-auto", "garageai/auto", "City"), model("none", "none", "", { garage: null })], [])).toEqual([]);
});

test("tier search distinguishes pool and dedicated for the same model and garage", () => {
  const options = autoModelOptions([
    model("pool-id", "deepseek/deepseek-v4.1-flash", "autoversio"),
    model("dedicated-id", "garage/autoversio/deepseek/deepseek-v4.1-flash", "autoversio", { garage_tier: "dedicated" }),
  ], []);
  expect(filterAutoModelOptions(options, "autoversio pool").map((o) => o.model.id)).toEqual(["pool-id"]);
  expect(filterAutoModelOptions(options, "DEDICATED").map((o) => o.model.id)).toEqual(["dedicated-id"]);
});

test("sort is model then garage then pool before dedicated regardless of IDs", () => {
  const options = autoModelOptions([
    model("a-dedicated", "garage/Alpha/zeta/model", "Alpha", { garage_tier: "dedicated" }),
    model("b-pool", "zeta/model", "Beta"),
    model("z-pool", "zeta/model", "Alpha"),
    model("first", "alpha/model", "Zulu"),
  ], []);
  expect(options.map((o) => o.model.id)).toEqual(["first", "z-pool", "a-dedicated", "b-pool"]);
});