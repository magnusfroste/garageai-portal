import { expect, test } from "bun:test";
import { isLiveStep } from "../../supabase/functions/_shared/onboardingLive.ts";
test("any counted Register with GarageAI step or register counts as live", () => {
  for (const s of ["5/6  Register with GarageAI", "4/5  Register with GarageAI", "register"]) expect(isLiveStep(s)).toBe(true);
  for (const s of ["4/5  Models", "Register with GarageAI later", "registered"]) expect(isLiveStep(s)).toBe(false);
});
