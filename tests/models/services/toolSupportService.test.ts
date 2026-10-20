import { describe, expect, test } from "bun:test";
import { modelSupportsTools } from "@/models/services/toolSupportService";

const rows = [
  { garage_name: "dgx-city", model: "xiaomi/mimo-v2.6-flash", supports_tools: true },
  { garage_name: "garage-m4", model: "ibm-granite/granite-4.1-3b", supports_tools: false },
];

describe("modelSupportsTools", () => {
  test("mine/<g>/<m> uses that garage's probe, like garage/<g>/<m>", () => {
    expect(modelSupportsTools(rows, "mine/dgx-city/xiaomi/mimo-v2.6-flash")).toBe(true);
    expect(modelSupportsTools(rows, "garage/dgx-city/xiaomi/mimo-v2.6-flash")).toBe(true);
  });

  test("mine id respects a failing probe and unknown garages", () => {
    expect(modelSupportsTools(rows, "mine/garage-m4/ibm-granite/granite-4.1-3b")).toBe(false);
    expect(modelSupportsTools(rows, "mine/unknown/xiaomi/mimo-v2.6-flash")).toBe(false);
  });

  test("pool names still match any garage serving the model", () => {
    expect(modelSupportsTools(rows, "xiaomi/mimo-v2.6-flash")).toBe(true);
    expect(modelSupportsTools(rows, "ibm-granite/granite-4.1-3b")).toBe(false);
  });
});
