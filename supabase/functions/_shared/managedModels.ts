// Models chosen in the portal, fetched by Bridge (docs/bridge.md). Pure, no Deno imports (unit-tested).
export type ManagedAction = "pull" | "remove";
export type ManagedBy = "operator" | "garageai" | "ops-test";
export type ManagedStatus = "wanted" | "downloading" | "ready" | "failed" | "removed" | "refused";
export interface ManagedRow { model: string; action: ManagedAction; by: ManagedBy; status: ManagedStatus; completed_mb?: number | null; total_mb?: number | null; error?: string | null; reported_at?: string | null }
export interface AgentModelReport { model: string; status: Exclude<ManagedStatus, "wanted">; by: ManagedBy | null; completed_mb: number | null; total_mb: number | null; error: string | null; at: string }
export interface WantedModel { model: string; action: ManagedAction; by: "operator" | "garageai" }

const REPORT_STATUSES = new Set(["downloading", "ready", "failed", "removed", "refused"]);
const MODEL_RE = /^[A-Za-z0-9._:/-]{1,200}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => v === null || v === undefined ? null : typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;

/** Validates agent.models; malformed entries are dropped with a reason, the rest kept. */
export function parseAgentModels(raw: unknown): { models: AgentModelReport[]; errors: string[] } {
  const models: AgentModelReport[] = [], errors: string[] = [];
  if (raw === undefined || raw === null) return { models, errors };
  if (!Array.isArray(raw)) return { models, errors: ["agent.models is not an array"] };
  for (const [i, e] of raw.slice(0, 100).entries()) {
    if (!isObj(e) || typeof e.model !== "string" || !MODEL_RE.test(e.model) || typeof e.status !== "string" || !REPORT_STATUSES.has(e.status)) { errors.push(`agent.models[${i}] invalid`); continue; }
    const completed = num(e.completed_mb), total = num(e.total_mb);
    const by = e.by === "operator" || e.by === "garageai" ? e.by : e.by == null ? null : undefined;
    const err = e.error == null ? null : typeof e.error === "string" ? e.error.slice(0, 300) : undefined;
    const at = typeof e.at === "string" && Number.isFinite(Date.parse(e.at)) ? e.at : e.at == null ? new Date().toISOString() : undefined;
    if (completed === undefined || total === undefined || by === undefined || err === undefined || at === undefined) { errors.push(`agent.models[${i}] invalid`); continue; }
    models.push({ model: e.model, status: e.status as AgentModelReport["status"], by, completed_mb: completed, total_mb: total, error: err, at });
  }
  if (raw.length > 100) errors.push("agent.models truncated to 100");
  return { models, errors };
}

/** Entry stays wanted until Bridge reports ready (pull) or removed (remove); failed/refused stay too. */
export const isOpen = (r: Pick<ManagedRow, "action" | "status">) => r.action === "pull" ? r.status !== "ready" : r.status !== "removed";
export const wantedModels = (rows: ManagedRow[]): WantedModel[] => rows.filter(isOpen).map((r) => ({ model: r.model, action: r.action, by: r.by === "operator" ? "operator" : "garageai" })); // Bridge contract knows only operator/garageai; ops tests are GarageAI's

const ACCEPTS: Record<ManagedAction, Set<string>> = { pull: new Set(["downloading", "ready", "failed", "refused"]), remove: new Set(["removed", "failed", "refused"]) };

/** Row updates from Bridge reports. Reports for unknown models or that don't fit the row's action are ignored. */
export function applyReports(rows: ManagedRow[], reports: AgentModelReport[]): Array<{ model: string; patch: Partial<ManagedRow> & { reported_at: string } }> {
  const byModel = new Map(rows.map((r) => [r.model, r]));
  const out: Array<{ model: string; patch: Partial<ManagedRow> & { reported_at: string } }> = [];
  for (const rep of reports) {
    const row = byModel.get(rep.model);
    if (!row || !isOpen(row) || !ACCEPTS[row.action].has(rep.status)) continue;
    // Sizes: a report without them never clears known values; ready means the whole download is done.
    const total = rep.total_mb ?? row.total_mb ?? null;
    const completed = rep.status === "ready" ? (rep.completed_mb ?? total) : (rep.completed_mb ?? row.completed_mb ?? null);
    out.push({ model: rep.model, patch: { status: rep.status, completed_mb: completed, total_mb: total, error: rep.error, reported_at: rep.at } });
  }
  return out;
}

/** Pulls that just became ready: asking for a model is the decision to offer it (no second click). */
export const readyToOffer = (rows: ManagedRow[], updates: Array<{ model: string; patch: Partial<ManagedRow> }>) =>
  updates.filter((u) => u.patch.status === "ready" && rows.find((r) => r.model === u.model)?.action === "pull").map((u) => u.model);

// ---------- Fit rule ----------
/** Fallback only, when the registry gives no size: GB ≈ parameters in B × 0.6 (Q4). */
export const estimatedSizeGb = (paramsB: number) => Math.round(paramsB * 0.6 * 10) / 10;
export const bytesToGb = (b: number) => Math.round((b / 1e9) * 10) / 10;
/** A model fits when its download size plus 2 GB spare fits in memory (RAM on Apple silicon, VRAM on NVIDIA). */
export const fitsMemory = (sizeGb: number | null, memoryGb: number | null) =>
  sizeGb != null && memoryGb != null && memoryGb > 0 && sizeGb + 2 <= memoryGb;
/** Fits together with the garage's current models (all loaded at once)? */
export const fitsTogether = (sizeGb: number | null, otherGb: number[], memoryGb: number | null) =>
  fitsMemory(sizeGb == null ? null : sizeGb + otherGb.reduce((a, b) => a + b, 0), memoryGb);

/** Idempotent auto-offer: fetched pulls Bridge now lists that are not offered yet (Bridge may list a model one heartbeat after reporting ready). */
/** Only within an hour of "ready", so an operator who later switches the offer off is not overridden. */
export const OFFER_WINDOW_MS = 60 * 60 * 1000;
export const pendingOffers = (rows: ManagedRow[], listed: string[], offered: Set<string>, now = Date.now()) =>
  rows.filter((r) => r.action === "pull" && r.status === "ready" && listed.includes(r.model) && !offered.has(r.model)
    && (!r.reported_at || now - Date.parse(r.reported_at) <= OFFER_WINDOW_MS)).map((r) => r.model);

/** What Cancel does (mirrors SQL apply_managed_model_cancel). Once Bridge has fetched, cancel becomes a remove. */
export function cancelOutcome(r: Pick<ManagedRow, "action" | "status"> | null): "none" | "delete" | "remove" | "revert" {
  if (!r) return "none";
  if (r.action === "remove") return r.status === "removed" ? "none" : "revert";
  return r.status === "downloading" || r.status === "ready" ? "remove" : "delete";
}
