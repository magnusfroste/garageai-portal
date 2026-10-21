import { describe, expect, it } from "bun:test";
import { pickChatModel, chatMachineFallback, type ChatModelCandidate } from "../../src/models/services/chatModelChoice";

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

  it("a healthy last-used model wins over auto and default", () => {
    const withAuto = [m("x", { is_default: true }), m("garageai/auto", { garage_tier: "auto" })];
    expect(pickChatModel(withAuto, null, "x")?.id).toBe("x");
    expect(pickChatModel(withAuto, "x", null)?.id).toBe("x");
  });

  const auto = m("garageai/auto", { garage_tier: "auto" });
  const mine = m("mine/garage-m4/meta/llama", { garage: "garage-m4", garage_tier: "private", last_heartbeat_at: "2026-10-21T22:00:00Z" });
  it("no garage and no history gives auto", () => {
    expect(pickChatModel([m("default", { is_default: true }), auto])?.id).toBe(auto.id);
  });
  it("an owner with an awake machine and no history gets the machine", () => {
    expect(pickChatModel([auto, mine])?.id).toBe(mine.id);
  });
  it("an owner whose machine is asleep gets auto and a fallback reference", () => {
    const asleep = { ...mine, status: "unhealthy" };
    expect(pickChatModel([asleep, auto])?.id).toBe(auto.id);
    expect(chatMachineFallback([asleep, auto])?.id).toBe(mine.id);
  });
  it("an owner whose last choice was auto gets auto", () => {
    expect(pickChatModel([mine, auto], null, auto.id)?.id).toBe(auto.id);
  });
  it("a link-requested model wins over history and an awake machine", () => {
    expect(pickChatModel([mine, auto, m("linked", { status: "offline" })], "linked", auto.id)?.id).toBe("linked");
  });
  it("picks the newest heartbeat among awake machines, not list order", () => {
    const newer = { ...mine, id: "mine/new/meta/llama", last_heartbeat_at: "2026-10-21T22:12:00Z" };
    expect(pickChatModel([mine, auto, newer])?.id).toBe(newer.id);
    expect(pickChatModel([{ ...newer, status: "unhealthy" }, mine, auto])?.id).toBe(mine.id);
  });
  it("an unavailable remembered own machine falls back to auto, not another machine", () => {
    const asleep = { ...mine, status: "unhealthy" };
    const awake = { ...mine, id: "mine/other/meta/llama" };
    expect(pickChatModel([asleep, awake, auto], null, asleep.id)?.id).toBe(auto.id);
    expect(chatMachineFallback([asleep, awake, auto], null, asleep.id)?.id).toBe(asleep.id);
  });
  it("does not show fallback for a link override, awake owner, or chosen auto", () => {
    const asleep = { ...mine, status: "unhealthy" };
    expect(chatMachineFallback([asleep, auto], asleep.id)).toBeUndefined();
    expect(chatMachineFallback([mine, auto])).toBeUndefined();
    expect(chatMachineFallback([asleep, auto], null, auto.id)).toBeUndefined();
  });

  it("returns undefined with no models", () => {
    expect(pickChatModel([], "a", "b")).toBeUndefined();
  });
});
