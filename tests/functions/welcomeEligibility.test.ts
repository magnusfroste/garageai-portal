import { expect, test } from "bun:test";
import { welcomeEligible } from "../../supabase/functions/_shared/welcomeEligibility";
const createdAt = "2026-10-16T22:00:00Z";
const empty = { createdAt, hasEverCreatedKey: false, hasLinkedGarage: false, sentAt: null };
test("welcome waits ten minutes", () => {
  expect(welcomeEligible(empty, Date.parse(createdAt) + 599999)).toBe(false);
  expect(welcomeEligible(empty, Date.parse(createdAt) + 600000)).toBe(true);
});
test("creating even a revoked key prevents the welcome", () => expect(welcomeEligible({ ...empty, hasEverCreatedKey: true }, Date.parse(createdAt) + 600000)).toBe(false));
test("linking a garage prevents the welcome", () => expect(welcomeEligible({ ...empty, hasLinkedGarage: true }, Date.parse(createdAt) + 600000)).toBe(false));
test("a previously sent welcome cannot be sent twice", () => expect(welcomeEligible({ ...empty, sentAt: createdAt }, Date.parse(createdAt) + 600000)).toBe(false));