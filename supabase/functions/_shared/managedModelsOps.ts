// Gateway-facing ops API for the nightly managed-models end-to-end test. Pure: storage is injected (unit-tested).
export const OPS_BY = "ops-test";
const MODEL_RE = /^[A-Za-z0-9._:/-]{1,200}$/;
const NAME_RE = /^[A-Za-z0-9._-]{1,80}$/;

export type OpsBody =
  | { op: "want"; garage: string; model: string; action: "pull" | "remove" }
  | { op: "cancel"; garage: string; model: string }
  | { op: "status"; garage: string };

export function parseOpsBody(raw: unknown): OpsBody | string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "body must be a JSON object";
  const b = raw as Record<string, unknown>;
  if (typeof b.garage !== "string" || !NAME_RE.test(b.garage)) return "invalid garage";
  if (b.op === "status") return { op: "status", garage: b.garage };
  if (b.op !== "want" && b.op !== "cancel") return "op must be want, cancel or status";
  if (typeof b.model !== "string" || !MODEL_RE.test(b.model)) return "invalid model";
  if (b.op === "cancel") return { op: "cancel", garage: b.garage, model: b.model };
  if (b.action !== "pull" && b.action !== "remove") return "action must be pull or remove";
  return { op: "want", garage: b.garage, model: b.model, action: b.action };
}

export interface OpsGarage { id: string; name: string; operator_id: string | null }
export interface OpsStore {
  garage(name: string): Promise<OpsGarage | null>;
  isAdmin(userId: string): Promise<boolean>;
  want(garageId: string, model: string, action: "pull" | "remove"): Promise<void>; // throws Error(message) on rule violation
  cancel(garageId: string, model: string): Promise<void>;
  managedRows(garageId: string, model?: string): Promise<Array<Record<string, unknown> & { model: string }>>;
  inventory(garageId: string): Promise<Array<{ model: string; installed: boolean; offered: boolean; status: string }>>;
  latestTests(garageId: string): Promise<Array<{ model: string; passed: boolean; tested_at: string }>>; // newest first, conclusive only
}

export async function handleOps(store: OpsStore, body: OpsBody): Promise<{ status: number; body: unknown }> {
  const g = await store.garage(body.garage);
  if (!g) return { status: 404, body: { error: "garage not found" } };
  if (body.op === "status") {
    const [rows, inv, tests] = await Promise.all([store.managedRows(g.id), store.inventory(g.id), store.latestTests(g.id)]);
    const invBy = new Map(inv.map((r) => [r.model, r]));
    const testBy = new Map<string, { passed: boolean; at: string }>();
    for (const t of tests) if (!testBy.has(t.model)) testBy.set(t.model, { passed: t.passed, at: t.tested_at });
    const models = [...new Set([...rows.map((r) => r.model), ...inv.map((r) => r.model)])].sort().map((m) => {
      const i = invBy.get(m);
      return { model: m, garage_model: i ? { installed: i.installed, offered: i.offered, status: i.status } : null, latest_test: testBy.get(m) ?? null };
    });
    return { status: 200, body: { garage: g.name, managed: rows, models } };
  }
  if (!g.operator_id || !(await store.isAdmin(g.operator_id))) return { status: 403, body: { error: "only garages owned by a GarageAI admin can be used for ops tests" } };
  try {
    if (body.op === "want") {
      await store.want(g.id, body.model, body.action);
      const [row] = await store.managedRows(g.id, body.model);
      return { status: 200, body: { garage: g.name, row: row ?? null } };
    }
    await store.cancel(g.id, body.model);
    const [row] = await store.managedRows(g.id, body.model);
    return { status: 200, body: { garage: g.name, model: body.model, cancelled: true, row: row ?? null } };
  } catch (e) {
    return { status: 422, body: { error: e instanceof Error ? e.message : "rejected" } };
  }
}
