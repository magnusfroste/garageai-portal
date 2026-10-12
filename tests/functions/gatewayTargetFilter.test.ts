import { expect, test } from "bun:test";
import { isGatewayTarget } from "../../supabase/functions/_shared/gatewayTargetFilter";

test("gateway-targets excludes paused garages and providers", () => {
  expect(isGatewayTarget({ disabled: false, paused_at: "2026-10-12T18:00:00Z" })).toBe(false);
  expect(isGatewayTarget({ disabled: true, paused_at: null })).toBe(false);
  expect(isGatewayTarget({ disabled: false, paused_at: null })).toBe(true);
});
