// Pure rules for the customer keys API (OpenRouter-shaped). No I/O; tested in tests/functions/customerKeys.test.ts.
export const MANAGEMENT_PREFIX = "gai-mgmt-";
export const MAX_KEYS_PER_ACCOUNT = 100;
export const MANAGEMENT_CALLS_PER_MINUTE = 60;
export type LimitReset = "daily" | "weekly" | "monthly";
const RESETS: Record<LimitReset, string> = { daily: "1d", weekly: "7d", monthly: "30d" };

/** limit_reset → LiteLLM budget_duration; null clears it. */
export function budgetDuration(reset: LimitReset | null | undefined): string | null {
  return reset ? RESETS[reset] : null;
}

/** 36 random bytes → 48 url-safe characters. */
export function newManagementKeyValue(bytes = crypto.getRandomValues(new Uint8Array(36))): string {
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return MANAGEMENT_PREFIX + b64;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export type Route =
  | { kind: "keys" } | { kind: "key"; hash: string } | { kind: "activity"; hash: string }
  | { kind: "credits" } | { kind: "self" } | { kind: "unknown" };

/** Routes on the path after the function name, e.g. /functions/v1/customer-keys/v1/keys/{hash}. */
export function parseRoute(pathname: string): Route {
  const at = pathname.indexOf("customer-keys");
  let rest = at >= 0 ? pathname.slice(at + "customer-keys".length) : pathname;
  rest = rest.replace(/\/+$/, "").replace(/^\/v1(?=\/|$)/, "");
  if (rest === "/keys") return { kind: "keys" };
  if (rest === "/credits") return { kind: "credits" };
  if (rest === "/key") return { kind: "self" };
  const m = rest.match(/^\/keys\/([^/]+)(\/activity)?$/);
  if (m) return m[2] ? { kind: "activity", hash: decodeURIComponent(m[1]) } : { kind: "key", hash: decodeURIComponent(m[1]) };
  return { kind: "unknown" };
}

/** The only lookup for a key by hash: restricted to the management key's own account. */
export function ownKey<T extends { user_id: string; litellm_token: string | null; revoked_at?: string | null }>(keys: T[], userId: string, hash: string): T | null {
  return keys.find(k => k.user_id === userId && !!k.litellm_token && k.litellm_token === hash && !k.revoked_at) ?? null;
}

export interface KeyFields { name?: string; disabled?: boolean; limit?: number | null; limit_reset?: LimitReset | null; models?: string[]; rpm?: number | null; metadata?: Record<string, unknown> | null }
type Result = { ok: true; value: KeyFields } | { ok: false; message: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const CREATE = ["name", "limit", "limit_reset", "models", "rpm", "metadata"];
const PATCH = [...CREATE, "disabled"];

/** Validates create (name required) or patch (at least one field) bodies; models must be in `known`. */
export function validateKeyBody(body: unknown, mode: "create" | "patch", known: Set<string>): Result {
  if (!isObj(body)) return { ok: false, message: "Body must be a JSON object" };
  const allowed = mode === "create" ? CREATE : PATCH;
  const extra = Object.keys(body).filter(k => !allowed.includes(k));
  if (extra.length) return { ok: false, message: `Unknown field: ${extra[0]}` };
  const out: KeyFields = {};
  if ("name" in body || mode === "create") {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 80) return { ok: false, message: "name must be a non-empty string of at most 80 characters" };
    out.name = body.name.trim();
  }
  if ("disabled" in body) { if (typeof body.disabled !== "boolean") return { ok: false, message: "disabled must be true or false" }; out.disabled = body.disabled; }
  if ("limit" in body) {
    if (body.limit !== null && (typeof body.limit !== "number" || !Number.isFinite(body.limit) || body.limit < 0)) return { ok: false, message: "limit must be a number >= 0 or null" };
    out.limit = body.limit as number | null;
  }
  if ("limit_reset" in body) {
    if (body.limit_reset !== null && !(typeof body.limit_reset === "string" && body.limit_reset in RESETS)) return { ok: false, message: "limit_reset must be \"daily\", \"weekly\", \"monthly\" or null" };
    out.limit_reset = body.limit_reset as LimitReset | null;
  }
  if ("models" in body) {
    if (!Array.isArray(body.models) || body.models.length > 50 || body.models.some(m => typeof m !== "string")) return { ok: false, message: "models must be an array of at most 50 model names" };
    const unknown = (body.models as string[]).find(m => !known.has(m));
    if (unknown) return { ok: false, message: `Unknown model: ${unknown}` };
    out.models = [...new Set(body.models as string[])];
  }
  if ("rpm" in body) {
    if (body.rpm !== null && (!Number.isInteger(body.rpm) || (body.rpm as number) < 1 || (body.rpm as number) > 10000)) return { ok: false, message: "rpm must be an integer between 1 and 10000 or null" };
    out.rpm = body.rpm as number | null;
  }
  if ("metadata" in body) {
    if (body.metadata !== null && !isObj(body.metadata)) return { ok: false, message: "metadata must be an object or null" };
    if (JSON.stringify(body.metadata ?? {}).length > 4000) return { ok: false, message: "metadata is too large (max 4000 characters)" };
    out.metadata = body.metadata as Record<string, unknown> | null;
  }
  if (mode === "patch" && !Object.keys(out).length) return { ok: false, message: "Nothing to update" };
  return { ok: true, value: out };
}

/** LiteLLM /key/update fields for a validated patch. `defaultRpm` restores portal limits when rpm is cleared. */
export function gatewayUpdate(fields: KeyFields, base: { internal: boolean; defaultRpm: number }): Record<string, unknown> {
  const u: Record<string, unknown> = {};
  if ("disabled" in fields) u.blocked = fields.disabled;
  if ("limit" in fields) u.max_budget = fields.limit;
  if ("limit_reset" in fields) u.budget_duration = budgetDuration(fields.limit_reset);
  if ("models" in fields) u.models = fields.models;
  if ("rpm" in fields) u.rpm_limit = fields.rpm ?? base.defaultRpm;
  if ("metadata" in fields) u.metadata = { ...(fields.metadata ?? {}), internal: base.internal, kind: "managed" };
  return u;
}

export interface Day { date: string; spend: number }
/** Credits spent over the last 1, 7 and 30 UTC days (days sorted oldest → newest, newest is today). */
export function usageWindows(days: Day[]) {
  const sum = (n: number) => days.slice(-n).reduce((s, d) => s + d.spend, 0);
  return { usage_daily: sum(1), usage_weekly: sum(7), usage_monthly: sum(30) };
}

export interface KeyRow { name: string; key_last4: string | null; litellm_token: string | null; is_active: boolean; limit_usd: number | null; limit_reset: string | null; models: string[] | null; rpm: number | null; metadata: unknown; created_at: string; updated_at: string | null }
/** OpenRouter Key object (credits; 1 credit = 1 USD via usdToCredits). */
export function keyObject(row: KeyRow, spend: number, windows: ReturnType<typeof usageWindows>, toCredits: (usd: number) => number) {
  const limit = row.limit_usd == null ? null : Number(row.limit_usd);
  return {
    hash: row.litellm_token, name: row.name, label: `sk-…${row.key_last4 ?? ""}`, disabled: !row.is_active,
    limit: limit == null ? null : toCredits(limit), limit_remaining: limit == null ? null : toCredits(Math.max(0, limit - spend)),
    limit_reset: row.limit_reset, usage: toCredits(spend),
    usage_daily: toCredits(windows.usage_daily), usage_weekly: toCredits(windows.usage_weekly), usage_monthly: toCredits(windows.usage_monthly),
    created_at: row.created_at, updated_at: row.updated_at ?? row.created_at,
    models: row.models ?? [], rpm: row.rpm, metadata: row.metadata ?? null,
  };
}

const rec = (v: unknown): Record<string, unknown> => isObj(v) ? v : {};
const num = (v: unknown) => Math.max(0, Number(v) || 0);
/** Per-day, per-model activity for one key from /user/daily/activity rows. */
export function keyModelActivity(rows: unknown[], token: string, alias: string | null, dates: string[]) {
  const out: { date: string; model: string; requests: number; prompt_tokens: number; completion_tokens: number; cached_tokens: number; cost: number }[] = [];
  const match = (k: string, e: unknown) => k === token || (!!alias && rec(rec(e).metadata).key_alias === alias);
  for (const raw of rows) {
    const row = rec(raw); const date = String(row.date ?? "").slice(0, 10);
    if (!dates.includes(date)) continue;
    for (const [model, mEntry] of Object.entries(rec(rec(row.breakdown).models))) {
      for (const [k, e] of Object.entries(rec(rec(mEntry).api_key_breakdown))) {
        if (!match(k, e)) continue;
        const m = rec(rec(e).metrics);
        out.push({ date, model, requests: num(m.api_requests), prompt_tokens: num(m.prompt_tokens), completion_tokens: num(m.completion_tokens), cached_tokens: num(m.cache_read_input_tokens), cost: num(m.spend) });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model));
}
