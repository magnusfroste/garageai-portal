import { expect, it, mock } from "bun:test";
mock.module("../../supabase/functions/_shared/proxyConfig.ts", () => ({ getProxyBaseUrl: async () => "https://gateway.fixture" }));
const { ensureLiteLLMUser } = await import("../../supabase/functions/_shared/litellmUsers.ts");

it("first user creation disables implicit keys and carries starting plus purchased budget", async () => {
  const originalFetch = globalThis.fetch;
  const originalDeno = (globalThis as Record<string, unknown>).Deno;
  (globalThis as Record<string, unknown>).Deno = { env: { get: () => "fixture-secret" } };
  let createdBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("/user/info")) return Response.json({ user_info: {} });
    if (String(url).endsWith("/user/new")) {
      createdBody = JSON.parse(String(init?.body));
      return Response.json({ user_id: "fixture-user" });
    }
    return Response.json({});
  }) as typeof fetch;
  const admin = { from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }) };
  try {
    await ensureLiteLLMUser(admin as never, { id: "fixture-user", starting_credit_usd: 5, purchased_credits_usd: 20 });
    expect(createdBody?.auto_create_key).toBe(false);
    expect(createdBody?.max_budget).toBe(25);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as Record<string, unknown>).Deno = originalDeno;
  }
});