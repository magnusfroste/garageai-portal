import { describe, expect, it } from "vitest";
import { cacheReadError, defaultCacheRead, effectiveCacheRead } from "@/models/services/cacheReadPricing";

describe("cache-read pricing", () => {
  it("defaults to 25 % of the input price", () => expect(defaultCacheRead(0.4)).toBeCloseTo(0.1));
  it("uses the default when nothing is set", () => expect(effectiveCacheRead(0.4, null, null)).toBeCloseTo(0.1));
  it("prefers a model override over the garage price", () => expect(effectiveCacheRead(0.4, 0.006, 0.2)).toBe(0.006));
  it("never exceeds the input price", () => expect(effectiveCacheRead(0.1, 0.5, null)).toBe(0.1));
  it("rejects a value above input", () => expect(cacheReadError("0.5", 0.4)).not.toBeNull());
  it("rejects a negative value", () => expect(cacheReadError("-1", 0.4)).not.toBeNull());
  it("accepts 0 and input itself", () => { expect(cacheReadError("0", 0.4)).toBeNull(); expect(cacheReadError("0.4", 0.4)).toBeNull(); });
});
