import { expect, test } from "bun:test";
import { modelIdError } from "../../supabase/functions/_shared/modelValidation";

test("admin endpoint providers accept original vendor model names", () => {
  for (const name of ["claude-haiku-5-5", "anthropic/claude-haiku-5-5", "gpt-4o", "openai/gpt-4o", "gemini-2.0-flash", "grok-2", "o3-mini"]) {
    expect(modelIdError(name, true)).toBeNull();
  }
});

test("ordinary garages cannot impersonate original vendor models", () => {
  for (const name of ["claude-haiku-5-5", "anthropic/claude-haiku-5-5", "gpt-4o", "openai/gpt-4o", "gemini-2.0-flash", "grok-2", "o3-mini"]) {
    expect(modelIdError(name)).not.toBeNull();
  }
});

test("providers cannot use internal routes or malformed names", () => {
  for (const name of ["garage/a/model", "probe/test", "garageai/auto", "GARAGEAI/auto", "bad name", "", "x".repeat(129)]) {
    expect(modelIdError(name, true)).not.toBeNull();
  }
});

test("open-weight garage models remain allowed", () => {
  for (const name of ["gpt-oss:20b", "openai/gpt-oss-120b", "Qwen/Qwen3-32B", "granite-4.1-3b-Q8_0.gguf"]) {
    expect(modelIdError(name)).toBeNull();
  }
});