import { describe, expect, it } from "bun:test";
import { fromPrice, modelContext, offerPlace, paidAverage } from "../../src/models/services/catalogPresentation";
import type { CatalogModel, GarageOffer } from "../../src/models/types/catalog.types";

const offer = (p: Partial<GarageOffer>): GarageOffer => ({ garage: "g", modelId: null, price: { input: 1, output: 2 }, grade: null, score: null, sampleDays: null, ttftMs: null, tokensPerSecond: null, availability30d: null, online: true, runtime: null, tokens7d: 0, providerName: null, location: null, ...p });
const model = (offers: GarageOffer[]) => ({ name: "qwen/x", contextLength: 999, minPrice: { input: 0, output: 0 }, offers } as unknown as CatalogModel);

describe("catalogue presentation", () => {
  it("context is the largest among garages that are up and flags variation", () => {
    const m = model([offer({ contextLength: 32000 }), offer({ contextLength: 128000 }), offer({ contextLength: 1_000_000, online: false })]);
    expect(modelContext(m)).toEqual({ value: 128000, varies: true });
  });
  it("from price is the cheapest garage that is up", () => {
    const m = model([offer({ price: { input: 0.5, output: 1 } }), offer({ price: { input: 0.1, output: 0.2 }, online: false })]);
    expect(fromPrice(m)).toEqual({ input: 0.5, output: 1 });
  });
  it("forwarding providers show varies and no flag", () => {
    expect(offerPlace({ forwardsTo: "OpenRouter", location: { country: "SE", location_display: "country" } as never })).toEqual({ flag: null, text: "varies" });
  });
  it("average paid is spend over tokens per million", () => {
    expect(paidAverage([{ model: "m", day: "d", requests: 1, promptTokens: 2_000_000, completionTokens: 1_000_000, inputSpend: 1, outputSpend: 3 }], "m")).toEqual({ input: 0.5, output: 3 });
  });
});

import { matchesWhere, whereClass, regionPlace } from "../../src/models/services/catalogPresentation";
describe("provider region / where it runs", () => {
  it("labels provider regions", () => {
    expect(regionPlace("se")).toEqual({ flag: "🇸🇪", text: "Sweden" });
    expect(regionPlace("eu").text).toBe("Europe");
    expect(regionPlace("other")).toEqual({ flag: "🌐", text: "Other" });
    expect(regionPlace(null).text).toBe("Unknown");
  });
  it("forwarding provider uses its region, not varies", () => {
    expect(offerPlace({ forwardsTo: "OpenRouter", isProvider: true, providerRegion: "other", location: null })).toEqual({ flag: "🌐", text: "Other" });
  });
  it("Europe includes Sweden; Sweden excludes other EU", () => {
    const se = whereClass({ isProvider: true, providerRegion: "se" });
    const de = whereClass({ location: { country: "DE", location_display: "country", is_endpoint: false } as never });
    const other = whereClass({ isProvider: true, providerRegion: "other" });
    expect([matchesWhere(se, "eu"), matchesWhere(de, "eu"), matchesWhere(other, "eu")]).toEqual([true, true, false]);
    expect([matchesWhere(se, "se"), matchesWhere(de, "se")]).toEqual([true, false]);
    expect(whereClass({ location: { country: "SE", location_display: "country", is_endpoint: false } as never })).toBe("se");
  });
});
