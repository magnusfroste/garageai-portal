import { describe, expect, it } from "bun:test";
import { chatKeyName, HIDDEN_PREFIX, keyLast4, storedKeyValue } from "../../supabase/functions/_shared/portalKeys.ts";

describe("show-once key storage", () => {
  it("stores no plain-text value for show-once keys", () => {
    const v = storedKeyValue("sk-abcdefgh1234", true, "row-1");
    expect(v).toBe(`${HIDDEN_PREFIX}row-1`);
    expect(v).not.toContain("sk-");
  });
  it("keeps only the last 4 characters", () => expect(keyLast4("sk-abcdefgh1234")).toBe("1234"));
  it("names chat keys after the device", () => {
    expect(chatKeyName("Chrome on Mac")).toBe("Chat · Chrome on Mac");
    expect(chatKeyName("<script>")).toBe("Chat · script");
    expect(chatKeyName(undefined)).toBe("Chat · this browser");
  });
});
