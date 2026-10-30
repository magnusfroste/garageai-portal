import { describe, expect, it } from "bun:test";
import { moveChatsToDevice, type ChatMoveDeps } from "@/models/services/chatMoveService";
import { mergeAccountChats } from "@/models/services/chatSyncService";
import type { Conversation } from "@/views/Chat/types";

const conv = (id: string, updatedAt = 1): Conversation => ({ id, title: id, model: "m", messages: [], createdAt: 1, updatedAt });
const twelve = Array.from({ length: 12 }, (_, i) => conv(`c${i}`, i));

function deps(over: Partial<ChatMoveDeps> = {}) {
  const device = new Set<string>();
  const deleted: string[][] = [];
  const d: ChatMoveDeps = {
    importLocal: (c) => { c.forEach((x) => device.add(x.id)); return true; },
    localIds: () => new Set(device),
    removeFromAccount: async (ids) => { deleted.push(ids); },
    saveSyncOff: async () => {},
    ...over,
  };
  return { d, deleted, device };
}

describe("existing account chats", () => {
  it("an existing user sees every chat already stored in the account", () => {
    const account = [conv("a", 3), conv("b", 2)];
    const shown = mergeAccountChats([], account);
    expect(shown.map((c) => c.id)).toEqual(["a", "b"]);
    expect(mergeAccountChats([conv("local", 5), conv("a", 3)], account).map((c) => c.id)).toEqual(["local", "a", "b"]);
  });
});

describe("move to this device only", () => {
  it("moves 12 conversations: verified on device, then deleted from account", async () => {
    const { d, deleted, device } = deps();
    expect(await moveChatsToDevice(twelve, d)).toEqual({ ok: true, moved: 12 });
    expect(device.size).toBe(12);
    expect(deleted).toEqual([twelve.map((c) => c.id)]);
  });

  it("fails halfway (only 6 of 12 land on the device): nothing deleted", async () => {
    const device = new Set<string>();
    const { d, deleted } = deps({
      importLocal: (c) => { c.slice(0, 6).forEach((x) => device.add(x.id)); return true; },
      localIds: () => device,
    });
    const r = await moveChatsToDevice(twelve, d);
    expect(r).toEqual({ ok: false, reason: "count_mismatch", deleted: false });
    expect(deleted).toEqual([]);
  });

  it("device refuses the copy: nothing deleted", async () => {
    const { d, deleted } = deps({ importLocal: () => false });
    expect((await moveChatsToDevice(twelve, d)).ok).toBe(false);
    expect(deleted).toEqual([]);
  });

  it("setting cannot be saved: nothing deleted", async () => {
    const { d, deleted } = deps({ saveSyncOff: async () => { throw new Error("x"); } });
    expect((await moveChatsToDevice(twelve, d)).ok).toBe(false);
    expect(deleted).toEqual([]);
  });

  it("account chats not loaded: never deletes", async () => {
    const { d, deleted } = deps();
    expect((await moveChatsToDevice([], d)).ok).toBe(false);
    expect(deleted).toEqual([]);
  });
});
