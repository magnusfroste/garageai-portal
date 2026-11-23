import { describe, it, expect } from "bun:test";
import { errorMessage } from "../../src/data/repositories/edgeError";

describe("errorMessage", () => {
  it("passes on a PostgrestError-like plain object's message", () => {
    expect(errorMessage({ message: "column x does not exist", code: "42703" })).toBe("column x does not exist");
  });
  it("uses Error.message and falls back otherwise", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage(null, "Unknown error")).toBe("Unknown error");
  });
});
