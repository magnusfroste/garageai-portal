import { expect, test } from "bun:test";
import { approvalVisibility } from "../../supabase/functions/_shared/bridgeVisibility.ts";

test("Only me is private before Bridge receives credentials", () => expect(approvalVisibility("private", "market")).toBe("private"));
test("Me and the market selects market", () => expect(approvalVisibility("market", "private")).toBe("market"));
test("legacy relink preserves existing Only me access", () => expect(approvalVisibility(undefined, "private")).toBe("private"));
test("legacy new link retains existing market default", () => expect(approvalVisibility(undefined)).toBe("market"));
test("invalid visibility is rejected", () => expect(() => approvalVisibility("everyone")).toThrow("visibility must be private or market"));