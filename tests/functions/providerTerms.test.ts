import { expect, test } from "bun:test";
import { parseProviderTermsInput, operatorTermsState } from "../../supabase/functions/_shared/providerTerms.ts";
import { TERMS_VERSION } from "../../supabase/functions/_shared/garageTerms.ts";

const now = new Date("2026-11-23T22:30:00Z");

test("record defaults to the current operator terms version and today", () => {
  expect(parseProviderTermsInput({ action: "record" }, now)).toEqual({ action: "record", version: TERMS_VERSION, acceptedAt: now.toISOString(), note: null });
});
test("record keeps the given date and note", () => {
  expect(parseProviderTermsInput({ action: "record", accepted_at: "2026-11-20", note: " signed agreement 2026-11-20 " }, now)).toMatchObject({ acceptedAt: "2026-11-20T12:00:00.000Z", note: "signed agreement 2026-11-20" });
});
test("future dates and unknown actions are rejected", () => {
  expect(parseProviderTermsInput({ action: "record", accepted_at: "2026-12-30" }, now)).toBeString();
  expect(parseProviderTermsInput({ action: "delete" }, now)).toBeString();
});
test("an older accepted version shows as old, none as missing", () => {
  expect(operatorTermsState({ terms_accepted_at: "2026-10-07", terms_version: "prompt-confidentiality-2025-01" })).toBe("old");
  expect(operatorTermsState({ terms_accepted_at: "2026-10-07", terms_version: TERMS_VERSION })).toBe("current");
  expect(operatorTermsState({ terms_accepted_at: null })).toBe("missing");
});
