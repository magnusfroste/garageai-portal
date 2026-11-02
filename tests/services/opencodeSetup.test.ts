import { describe, expect, it } from "bun:test";
import { opencodeSetupCommand } from "@/models/services/opencodeSetup";

describe("opencodeSetupCommand", () => {
  const line = opencodeSetupCommand("sk-abc_DEF-123");
  it("contains the key exactly once, single-quoted", () => {
    expect(line.split("sk-abc_DEF-123").length - 1).toBe(1);
    expect(line).toContain("GARAGE_API_KEY 'sk-abc_DEF-123'");
  });
  it("never overwrites an existing opencode.json", () => {
    expect(line).toContain('if [ -e "$d/opencode.json" ]');
    expect(line).toContain('-o "$d/garageai.json"');
  });
  it("ends with the opencode run test", () => {
    expect(line.endsWith('opencode run -m garageai/auto "Say hello in one sentence."')).toBe(true);
  });
});
