import { describe, expect, it } from "bun:test";
import { pickChatModel, type ChatModelCandidate } from "../../src/models/services/chatModelChoice";

const m = (id: string, over: Partial<ChatModelCandidate> = {}): ChatModelCandidate => ({ id, status: "healthy", ...over });

describe("pickChatModel", () => {
  const models = [
    m("a", { status: "offline" }),
    m("b", { is_default: true, status: "offline" }),
    m("c", { garage: "g1", garage_tier: "dedicated" }),
    m("d"),
  ];

  it("keeps an explicitly requested model even when unhealthy", () => {
    expect(pickChatModel(models, "a", "c")?.id).toBe("a");
  });

  it("uses last used only when healthy", () => {
    expect(pickChatModel(models, null, "c")?.id).toBe("c");
    expect(pickChatModel(models, null, "a")?.id).toBe("d"); // a offline → falls through to healthy pool
  });

  it("uses the default only when healthy", () => {
    expect(pickChatModel(models, null, null)?.id).toBe("d"); // b is default but offline
    expect(pickChatModel([m("x", { is_default: true }), m("y")], null, null)?.id).toBe("x");
  });

  it("prefers the first healthy pool model over a healthy garage model", () => {
    expect(pickChatModel(models, null, null)?.id).toBe("d");
  });

  it("falls back to first healthy, then first", () => {
    expect(pickChatModel([m("a", { status: "offline" }), m("b", { garage: "g" })], null, null)?.id).toBe("b");
    expect(pickChatModel([m("a", { status: "offline" })], null, null)?.id).toBe("a");
  });

  it("defaults to garageai/auto over last used and default", () => {
    const withAuto = [m("x", { is_default: true }), m("garageai/auto", { garage_tier: "auto" })];
    expect(pickChatModel(withAuto, null, "x")?.id).toBe("garageai/auto");
    expect(pickChatModel(withAuto, "x", null)?.id).toBe("x");
  });

  it("returns undefined with no models", () => {
    expect(pickChatModel([], "a", "b")).toBeUndefined();
  });
});
