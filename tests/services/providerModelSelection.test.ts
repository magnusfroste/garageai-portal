import { expect, test } from "bun:test";
import { addProviderModel, validProviderModelId } from "../../src/models/services/providerModelSelection";

test("TheHive model IDs can be selected without model discovery", () => {
  expect(addProviderModel([], "deepseek-ai/deepseek-v4.1-flash-1017")).toEqual(["deepseek-ai/deepseek-v4.1-flash-1017"]);
  expect(validProviderModelId("zai-org/glm-5.3-flash")).toBe(true);
});

test("manual model selection trims IDs and avoids duplicates", () => {
  expect(addProviderModel(["zai-org/glm-5.3-flash"], " zai-org/glm-5.3-flash ")).toEqual(["zai-org/glm-5.3-flash"]);
});

test("manual selection rejects invalid and reserved route IDs", () => {
  for (const model of ["", "bad name", "mine/a/model", "garage/a/model", "garageai/auto", "probe/test", "x".repeat(129)]) {
    expect(validProviderModelId(model)).toBe(false);
    expect(addProviderModel([], model)).toEqual([]);
  }
});