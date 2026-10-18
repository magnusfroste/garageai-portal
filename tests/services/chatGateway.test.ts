import { describe, expect, it, mock, beforeEach } from "bun:test";

// Privacy contract for the rebuilt chat:
// 1. Chat requests go straight to the EU gateway, never to a Supabase function.
// 2. web-search receives only { query } — never messages.
// 3. With sync off, nothing is written to chat_conversations.

const invokeCalls: Array<{ fn: string; body: unknown }> = [];

mock.module("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: async (fn: string, opts: { body: unknown }) => {
        invokeCalls.push({ fn, body: opts.body });
        if (fn === "chat-key-value") return { data: { key_value: "sk-test" }, error: null };
        if (fn === "web-search") return { data: { results: [{ title: "T", url: "https://x.se", content: "C" }] }, error: null };
        return { data: null, error: null };
      },
    },
  },
}));

const { GATEWAY_CHAT_URL, getChatKeyValue, runWebSearch, streamChat } = await import("@/models/services/chatGateway");

const sse = (chunks: unknown[]) =>
  new Response(
    new ReadableStream({
      start(c) {
        const enc = new TextEncoder();
        for (const ch of chunks) c.enqueue(enc.encode(`data: ${JSON.stringify(ch)}\n\n`));
        c.enqueue(enc.encode("data: [DONE]\n\n"));
        c.close();
      },
    }),
    { status: 200, headers: { "x-litellm-model-id": "garage-m1__qwen3__pool" } },
  );

const events = () => ({
  contents: [] as string[],
  onContent(t: string) { this.contents.push(t); },
  onReasoning() {},
  onUsage() {},
  onGarage() {},
  onSearchStatus() {},
  onSources() {},
});

describe("chatGateway", () => {
  beforeEach(() => {
    invokeCalls.length = 0;
  });

  it("sends chat requests to the EU gateway, not to a Supabase function", async () => {
    const fetches: string[] = [];
    globalThis.fetch = mock(async (url: any) => {
      fetches.push(String(url));
      return sse([{ choices: [{ delta: { content: "hej" } }] }]) as any;
    }) as any;

    const ev = events();
    await streamChat(
      { keyValue: "sk-test", model: "garageai/auto", messages: [{ role: "user", content: "hi" }], signal: new AbortController().signal },
      ev,
    );

    expect(fetches).toEqual([GATEWAY_CHAT_URL]);
    expect(GATEWAY_CHAT_URL).toBe("https://llm.garageai.eu/v1/chat/completions");
    expect(GATEWAY_CHAT_URL).not.toContain("supabase");
    expect(ev.contents.join("")).toBe("hej");
    // No chat payload went through any edge function.
    expect(invokeCalls.filter((c) => c.fn !== "chat-key-value" && c.fn !== "web-search")).toEqual([]);
  });

  it("sends the key as a bearer token to the gateway", async () => {
    let seenAuth = "";
    globalThis.fetch = mock(async (_url: any, init: any) => {
      seenAuth = init.headers.Authorization;
      return sse([{ choices: [{ delta: { content: "ok" } }] }]) as any;
    }) as any;
    await streamChat(
      { keyValue: "sk-secret", model: "m", messages: [{ role: "user", content: "hi" }], signal: new AbortController().signal },
      events(),
    );
    expect(seenAuth).toBe("Bearer sk-secret");
  });

  it("web-search receives only the query string, never messages", async () => {
    const results = await runWebSearch("weather in stockholm");
    expect(results).toHaveLength(1);
    const call = invokeCalls.find((c) => c.fn === "web-search");
    expect(call).toBeDefined();
    expect(Object.keys(call!.body as object)).toEqual(["query"]);
    expect((call!.body as any).query).toBe("weather in stockholm");
  });

  it("runs the browser tool loop: model tool_call → web-search → follow-up round", async () => {
    const bodies: any[] = [];
    let round = 0;
    globalThis.fetch = mock(async (_url: any, init: any) => {
      bodies.push(JSON.parse(init.body));
      round++;
      if (round === 1) {
        return sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "web_search", arguments: '{"query":"news"}' } } ] }] } }]) as any;
      }
      return sse([{ choices: [{ delta: { content: "answer" } }] }]) as any;
    }) as any;

    const ev = events();
    await streamChat(
      { keyValue: "sk-test", model: "m", messages: [{ role: "user", content: "latest news" }], webSearch: true, signal: new AbortController().signal },
      ev,
    );

    expect(bodies).toHaveLength(2);
    expect(bodies[0].tools).toBeDefined();
    // Round 2 includes the tool result, but the search function only ever saw { query }.
    expect(bodies[1].messages.some((m: any) => m.role === "tool")).toBe(true);
    const searchCall = invokeCalls.find((c) => c.fn === "web-search");
    expect(Object.keys(searchCall!.body as object)).toEqual(["query"]);
    expect(ev.contents.join("")).toBe("answer");
  });

  it("caches the key value in memory (one chat-key-value call per key)", async () => {
    await getChatKeyValue("key-1");
    await getChatKeyValue("key-1");
    expect(invokeCalls.filter((c) => c.fn === "chat-key-value")).toHaveLength(1);
  });
});
