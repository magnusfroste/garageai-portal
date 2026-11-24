import { expect, test } from "bun:test";
import { autoEntryValue, autoSelection, buildAutoEntries, autoModelOptions, filterAutoModelOptions } from "../../src/models/services/autoRouteService";
import type { CuratedModel } from "../../src/models/types/curatedModel.types";
import type { AutoRouteEntry } from "../../src/models/types/autoRoute.types";

const model = (id: string, name: string, garage: string, patch: Partial<CuratedModel> = {}): CuratedModel => ({
  id, model_name: name, garage, provider: "vendor", enabled: true, status: "healthy", garage_tier: "pool",
  max_input_tokens: 128000, max_output_tokens: 32000, input_cost_per_million: 0.1, output_cost_per_million: 0.3,
  mode: "chat", is_default: false, huggingface_url: null, last_synced_at: "", created_at: "", updated_at: "", ...patch,
});
const entry: AutoRouteEntry = { id: "entry-1", curated_model_id: "a-id", position: 3, enabled: true, note: null, created_at: "" };

test("options sort by model name and search both model and supplier without changing IDs", () => {
  const options = autoModelOptions([model("z-id", "zeta/model", "Sweden"), model("a-id", "alpha/model", "City")], []).filter((o) => !o.poolModel);
  expect(options.map((o) => o.model.id)).toEqual(["a-id", "z-id"]);
  expect(filterAutoModelOptions(options, "ALPHA city").map((o) => o.model.id)).toEqual(["a-id"]);
  expect(filterAutoModelOptions(options, "sweden").map((o) => o.model.id)).toEqual(["z-id"]);
  expect(filterAutoModelOptions(options, "vendor")).toHaveLength(2);
});

test("already-used entries are visible but disabled, except the row being edited", () => {
  const models = [model("a-id", "alpha/model", "City")];
  expect(autoModelOptions(models, [entry]).find((o) => o.model.id === "a-id")).toMatchObject({ alreadyInAuto: true, disabled: true });
  expect(autoModelOptions(models, [entry], "entry-1").find((o) => o.model.id === "a-id")).toMatchObject({ alreadyInAuto: false, disabled: false });
});

test("down enabled models remain selectable; disabled models remain ineligible", () => {
  const options = autoModelOptions([model("down", "down", "City", { status: "unhealthy" }), model("off", "off", "City", { enabled: false })], []).filter((o) => !o.poolModel);
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
  expect(options.filter((o) => !o.poolModel).map((o) => o.model.id)).toEqual(["first", "z-pool", "a-dedicated", "b-pool"]);
});

test("one pool option per canonical name shows member count, price range and largest context and matches any", () => {
  const models = [model("a", "deepseek/flash", "Alpha", { input_cost_per_million: 0.05, max_input_tokens: 1000000 }), model("b", "deepseek/flash", "Beta", { input_cost_per_million: 0.1 })];
  const options = autoModelOptions(models, []);
  expect(filterAutoModelOptions(options, "any deepseek")).toHaveLength(1);
  expect(options.find((o) => o.poolModel)).toMatchObject({ poolModel: "deepseek/flash", supplier: "any garage (2)", inputLabel: "0.05–0.1", model: { max_input_tokens: 1000000 }, disabled: false });
});

test("pool selection replaces either target without changing positions and can round-trip", () => {
  expect(autoSelection("pool:deepseek/flash")).toEqual({ curated_model_id: null, pool_model: "deepseek/flash" });
  expect(autoSelection("a__m__pool")).toEqual({ curated_model_id: "a__m__pool", pool_model: null });
  expect(autoEntryValue({ curated_model_id: null, pool_model: "deepseek/flash" })).toBe("pool:deepseek/flash");
});

test("whole-pool list details show current healthy members and smallest context", () => {
  const models = [model("a", "deepseek/flash", "Alpha", { max_input_tokens: 1000000, supports_tools: true }), model("b", "deepseek/flash", "Beta", { max_input_tokens: 128000, supports_tools: true }), model("c", "deepseek/flash", "Down", { status: "unhealthy" })];
  const pool = { ...entry, curated_model_id: null, pool_model: "deepseek/flash" };
  const view = buildAutoEntries([pool], models, [], () => "A")[0];
  expect(view).toMatchObject({ label: "deepseek/flash", garage: "any garage (2)", context: 128000, members: ["Alpha", "Beta"], missing: false });
  expect(autoModelOptions(models, [pool]).find((o) => o.poolModel)).toMatchObject({ alreadyInAuto: true, disabled: true });
  expect(autoModelOptions(models, [pool], entry.id).find((o) => o.poolModel)).toMatchObject({ alreadyInAuto: false, disabled: false });
});