import { expect, test } from "bun:test";
import { handleOps, parseOpsBody, type OpsStore, type OpsBody } from "../../supabase/functions/_shared/managedModelsOps";
import { isGatewayAuthorized } from "../../supabase/functions/_shared/gatewayAuth";

(globalThis as any).Deno ??= { env: { get: (k: string) => (k === "LITELLM_MASTER_KEY" ? "secret-key" : undefined) } };
const req = (key?: string) => new Request("http://x", { method: "POST", headers: key ? { "x-gateway-key": key } : {} });

test("missing or wrong gateway key is unauthorized", async () => {
  expect(await isGatewayAuthorized(req())).toBe(false);
  expect(await isGatewayAuthorized(req("wrong"))).toBe(false);
  expect(await isGatewayAuthorized(req("secret-key"))).toBe(true);
});

function fakeStore() {
  const rows = new Map<string, any>();
  const garages: Record<string, { id: string; name: string; operator_id: string }> = {
    "garage-m2": { id: "g2", name: "garage-m2", operator_id: "admin-user" },
    "op-garage": { id: "g9", name: "op-garage", operator_id: "operator-user" },
  };
  const store: OpsStore = {
    garage: async (n) => garages[n] ?? null,
    isAdmin: async (u) => u === "admin-user",
    want: async (_g, model, action) => { rows.set(model, { model, action, by: "ops-test", status: "wanted" }); },
    cancel: async (_g, model) => { const r = rows.get(model); if (r?.action === "pull" && r.status !== "ready") rows.delete(model); },
    managedRows: async (_g, m) => [...rows.values()].filter((r) => !m || r.model === m),
    inventory: async () => [{ model: "qwen3:4b", installed: true, offered: true, status: "live" }],
    latestTests: async () => [{ model: "qwen3:4b", passed: true, tested_at: "2026-10-14T07:00:00Z" }, { model: "qwen3:4b", passed: false, tested_at: "2026-10-13T07:00:00Z" }],
  };
  return { store, rows };
}

test("want/cancel refuse garages not owned by an admin; status allowed", async () => {
  const { store } = fakeStore();
  expect((await handleOps(store, { op: "want", garage: "op-garage", model: "qwen3:0.6b", action: "pull" })).status).toBe(403);
  expect((await handleOps(store, { op: "cancel", garage: "op-garage", model: "qwen3:0.6b" })).status).toBe(403);
  expect((await handleOps(store, { op: "status", garage: "op-garage" })).status).toBe(200);
});

test("want -> status -> cancel lifecycle", async () => {
  const { store, rows } = fakeStore();
  const w = await handleOps(store, parseOpsBody({ op: "want", garage: "garage-m2", model: "qwen3:0.6b", action: "pull" }) as OpsBody);
  expect(w.status).toBe(200);
  expect((w.body as any).row).toMatchObject({ model: "qwen3:0.6b", by: "ops-test", status: "wanted" });
  const s = (await handleOps(store, { op: "status", garage: "garage-m2" })).body as any;
  expect(s.managed.map((r: any) => r.model)).toEqual(["qwen3:0.6b"]);
  expect(s.models.find((m: any) => m.model === "qwen3:4b").latest_test).toEqual({ passed: true, at: "2026-10-14T07:00:00Z" });
  expect(s.models.find((m: any) => m.model === "qwen3:0.6b").garage_model).toBeNull();
  const c = await handleOps(store, { op: "cancel", garage: "garage-m2", model: "qwen3:0.6b" });
  expect((c.body as any).row).toBeNull();
  expect(rows.size).toBe(0);
});

test("body validation", () => {
  expect(typeof parseOpsBody({ op: "want", garage: "garage-m2", model: "x" })).toBe("string");
  expect(typeof parseOpsBody({ op: "nuke", garage: "garage-m2" })).toBe("string");
  expect(typeof parseOpsBody({ op: "status", garage: "garage-m2" })).toBe("object");
});
