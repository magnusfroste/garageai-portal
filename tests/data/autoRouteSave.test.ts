import { expect, mock, test } from "bun:test";

const calls: Array<{ table: string; op: string; row: unknown }> = [];
let fail: { message: string } | null = null;
mock.module("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      insert: async (row: unknown) => { calls.push({ table, op: "insert", row }); return { error: fail }; },
      upsert: async (row: unknown) => { calls.push({ table, op: "upsert", row }); return { error: fail }; },
    }),
  },
}));

const { autoRouteRepository } = await import("../../src/data/repositories/autoRouteRepository");
const { autoErrorMessage, autoPriceError, nextAutoPosition, parseAutoSettings } = await import("../../src/models/services/autoRouteService");

test("add sends the curated model id at position 1 on an empty list", async () => {
  fail = null; calls.length = 0;
  await autoRouteRepository.add("dgx-city__mimo-v2.6-flash__pool", nextAutoPosition([]));
  expect(calls[0]).toEqual({ table: "auto_route", op: "insert", row: { curated_model_id: "dgx-city__mimo-v2.6-flash__pool", position: 1 } });
});

test("a failed insert or save is thrown with a readable message, never silent", async () => {
  fail = { message: "permission denied for table auto_route" };
  const err = await autoRouteRepository.add("x", 1).catch((e) => e);
  expect(autoErrorMessage(err)).toBe("permission denied for table auto_route");
  const err2 = await autoRouteRepository.saveSettings(parseAutoSettings({})).catch((e) => e);
  expect(autoErrorMessage(err2)).toBe("permission denied for table auto_route");
});

test("empty prices do not block Save; mimo prices are valid", () => {
  expect(autoPriceError(parseAutoSettings({}))).toBeNull();
  expect(autoPriceError(parseAutoSettings({ input_cost_per_million: 0.1, output_cost_per_million: 0.3, cache_read_cost_per_million: 0.025 }))).toBeNull();
});
