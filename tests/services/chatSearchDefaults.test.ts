import { describe, expect, it } from "bun:test";
import { webSearchEnabled } from "@/views/Chat/hooks/useWebSearchPreference";
import { searchSummary, servedModelLabel } from "@/models/services/chatService";

describe("web search preference", () => {
  it("defaults to on when the user never touched the switch", () => {
    expect(webSearchEnabled(null)).toBe(true);
  });
  it("keeps off for a user who explicitly turned it off", () => {
    expect(webSearchEnabled("0")).toBe(false);
  });
  it("keeps on for a user who explicitly turned it on", () => {
    expect(webSearchEnabled("1")).toBe(true);
  });
});

describe("search summary line", () => {
  it("carries every query and the source count", () => {
    const sum = searchSummary({ queries: ["weather stockholm", "smhi forecast"], sources: [1, 2, 3, 4, 5] });
    expect(sum).toEqual({ queries: ["weather stockholm", "smhi forecast"], count: 5 });
  });
  it("is null when nothing was searched", () => {
    expect(searchSummary({ queries: [], sources: [] })).toBeNull();
  });
});

describe("served model label", () => {
  it("shows auto → <catalogue display name> when the stream names the served model", () => {
    const label = servedModelLabel(
      { model: "garageai/auto", servedModel: "deepseek/deepseek-v4.1-flash" },
      (id) => (id === "deepseek/deepseek-v4.1-flash" ? "DeepSeek V4.1 Flash" : undefined),
    );
    expect(label).toBe("DeepSeek V4.1 Flash");
  });
  it("falls back to a prettified id without a catalogue name", () => {
    expect(servedModelLabel({ model: "garageai/auto", servedModel: "deepseek/deepseek-v4.1-flash" })).toBe("Deepseek V4.1 Flash");
  });
  it("shows nothing when the field still says garageai/auto (pre-deploy gateway)", () => {
    expect(servedModelLabel({ model: "garageai/auto", servedModel: "garageai/auto" })).toBeNull();
    expect(servedModelLabel({ model: "garageai/auto" })).toBeNull();
  });
  it("shows nothing for non-auto models", () => {
    expect(servedModelLabel({ model: "qwen/qwen3-4b", servedModel: "qwen/qwen3-4b" })).toBeNull();
  });
});
