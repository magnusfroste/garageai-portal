import { describe, expect, it, mock, beforeEach } from "bun:test";

// The chat makes its own key per browser, stores it only in that browser,
// and silently replaces it when the gateway rejects it.
const created: string[] = [];
let n = 0;
mock.module("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: async (fn: string, opts: { body: any }) => {
    if (fn === "generate-api-key") {
      n++; created.push(opts.body.deviceLabel);
      expect(opts.body.kind).toBe("chat");
      expect(opts.body.showOnce).toBe(true);
      return { data: { data: { id: `id-${n}`, key: `sk-chat-${n}`, name: `Chat · ${opts.body.deviceLabel}`, last4: "x" } }, error: null };
    }
    return { data: null, error: { message: "unexpected" } };
  } } },
}));

class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }
const browserA = new Mem(), browserB = new Mem();
(globalThis as any).navigator = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36" };

const { chatKeyService } = await import("@/models/services/chatKeyService");
const { deviceLabel } = await import("@/models/services/deviceLabel");

describe("chat keys", () => {
  beforeEach(() => { (globalThis as any).localStorage = browserA; });

  it("names the key after browser and OS", () => {
    expect(deviceLabel(navigator.userAgent)).toBe("Chrome on Mac");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/131.0")).toBe("Firefox on Windows");
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1")).toBe("Safari on iPhone");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0")).toBe("Edge on Windows");
  });

  it("creates one key on first use and reuses it in the same browser", async () => {
    const a1 = await chatKeyService.get("u1");
    const a2 = await chatKeyService.get("u1");
    expect(a1.key).toBe("sk-chat-1");
    expect(a2).toEqual(a1);
    expect(created).toEqual(["Chrome on Mac"]);
  });

  it("a second browser gets its own chat key", async () => {
    (globalThis as any).localStorage = browserB;
    const b = await chatKeyService.get("u1");
    expect(b.key).toBe("sk-chat-2");
    (globalThis as any).localStorage = browserA;
    expect((await chatKeyService.get("u1")).key).toBe("sk-chat-1");
  });

  it("a revoked key is replaced by a new one", async () => {
    const renewed = await chatKeyService.renew("u1");
    expect(renewed.key).toBe("sk-chat-3");
    expect((await chatKeyService.get("u1")).key).toBe("sk-chat-3");
    expect(chatKeyService.currentId("u1")).toBe("id-3");
  });
});
