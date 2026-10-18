import { describe, expect, it, mock, beforeEach } from "bun:test";

// Sync opt-in contract: with sync off, nothing is written to chat_conversations;
// the local store is the only persistence.

const tableWrites: Array<{ table: string; op: string }> = [];

const chain = (op: string) => {
  const handler: any = new Proxy({}, {
    get: (_t, prop) => {
      if (prop === "then") return (resolve: any) => resolve({ data: [], error: null });
      return (..._args: any[]) => handler;
    },
  });
  tableWrites.push({ table: "chat_conversations", op });
  return handler;
};

mock.module("@/integrations/supabase/client", () => ({
  supabase: {
    from: (_table: string) => chain("access"),
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  },
}));

// Minimal localStorage shim for the store.
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};
(globalThis as any).crypto ??= { randomUUID: () => `id-${Math.random().toString(36).slice(2)}` };

const { chatLocalStore } = await import("@/data/repositories/chatLocalStore");

describe("chatLocalStore (sync off)", () => {
  beforeEach(() => {
    mem.clear();
    tableWrites.length = 0;
  });

  it("stores conversations only in the browser — no chat_conversations writes", () => {
    const conv = chatLocalStore.create("u1", "garageai/auto", "New chat");
    chatLocalStore.update("u1", conv.id, { messages: [{ role: "user", content: "hi" }] });
    chatLocalStore.remove("u1", conv.id);

    expect(tableWrites.filter((w) => w.table === "chat_conversations")).toEqual([]);
    expect(mem.has("garageai:chat:convs:u1")).toBe(true);
  });

  it("keeps histories separate per user id", () => {
    chatLocalStore.create("u1", "m", "New chat");
    expect(chatLocalStore.list("u1")).toHaveLength(1);
    expect(chatLocalStore.list("u2")).toHaveLength(0);
  });

  it("importAll merges without duplicating existing ids", () => {
    const conv = chatLocalStore.create("u1", "m", "New chat");
    chatLocalStore.importAll("u1", [conv, { ...conv, id: "other", title: "From account" } as any]);
    const list = chatLocalStore.list("u1");
    expect(list).toHaveLength(2);
    expect(list.filter((c) => c.id === conv.id)).toHaveLength(1);
  });
});
