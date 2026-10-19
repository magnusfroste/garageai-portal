import { describe, expect, it } from "bun:test";
import { litellmKeyAlias, slugKeyName } from "../../supabase/functions/_shared/keyAlias.ts";
import { internalAlias } from "../../supabase/functions/_shared/internalTraffic.ts";

describe("internal LiteLLM key alias", () => {
  it("is <uid8>-<slug>-<4 chars>", () => {
    expect(litellmKeyAlias("9f6553e8-8d75-4fbb-b39d-3a0ac9f6c916", "Chat", "ab12")).toBe("9f6553e8-chat-ab12");
    expect(litellmKeyAlias("9f6553e8-x", "Min nyckel!")).toMatch(/^9f6553e8-min-nyckel-[a-z0-9]{4}$/);
  });
  it("two users with the same key name get different aliases", () => {
    expect(litellmKeyAlias("aaaaaaaa-1", "Chat")).not.toBe(litellmKeyAlias("bbbbbbbb-1", "Chat"));
  });
  it("slug falls back for empty names", () => expect(slugKeyName("!!!")).toBe("key"));
  it("internal test aliases stay internal; customer aliases do not", () => {
    expect(internalAlias("9f6553e8-test-ab12")).toBe(true);
    expect(internalAlias("9f6553e8-chat-ab12")).toBe(false);
  });
});
