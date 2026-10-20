import { describe, expect, test } from "bun:test";
import { publicModelName, requestDetails } from "@/models/services/requestLogService";

const log = (model_id: string) => ({
  model_id, startTime: "2026-10-20T21:00:00Z", endTime: "2026-10-20T21:00:01Z",
  request_id: "r", model: "m", total_tokens: 1, spend: 0, api_key: "k", status: "success",
});

describe("requestDetails", () => {
  test("parses private (mine) deployment ids like dedicated ones", () => {
    const d = requestDetails(log("dgx-city__xiaomi/mimo-v2.6-flash__private") as never);
    expect(d.garage).toBe("dgx-city");
    expect(d.tier).toBe("Your machine");
  });

  test("pool and dedicated tiers unchanged", () => {
    expect(requestDetails(log("g__m__pool") as never).tier).toBe("Pool");
    expect(requestDetails(log("g__m__dedicated") as never).tier).toBe("Specific garage");
  });
});

describe("publicModelName", () => {
  test("strips mine/ prefix like garage/", () => {
    expect(publicModelName("mine/dgx-city/xiaomi/mimo-v2.6-flash")).toBe("xiaomi/mimo-v2.6-flash");
    expect(publicModelName("garage/dgx-city/xiaomi/mimo-v2.6-flash")).toBe("xiaomi/mimo-v2.6-flash");
    expect(publicModelName("xiaomi/mimo-v2.6-flash")).toBe("xiaomi/mimo-v2.6-flash");
  });
});
