// Pure rules for the Bridge device-link flow (no I/O), shared by bridge-link-* functions and unit tests.
export const NAME_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
export const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
export const USER_CODE_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
export const LINK_TTL_S = 600;
export const POLL_INTERVAL_S = 3;
export const SLOW_DOWN_MS = 2000;
export const STARTS_PER_IP_PER_HOUR = 10;
export const VERIFICATION_URL = "https://app.garageai.eu/bridge/link";

export function makeUserCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(8);
  const chars = Array.from(bytes, (b) => USER_CODE_ALPHABET[b % USER_CODE_ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export const normaliseUserCode = (v: unknown) => {
  if (typeof v !== "string") return null;
  const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const code = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
  return USER_CODE_RE.test(code) ? code : null;
};

export function makeDeviceCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return "gbd_" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export const sanitizeName = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 41);

export interface StartFields {
  machine_id: string | null; hostname: string | null; os: string | null; arch: string | null; bridge_version: string | null;
  gpu: string | null; runtime: string | null; suggested_name: string | null; memory_gb: number | null; models: string[];
  transport: "netbird" | "tunnel";
}

const STRING_FIELDS = ["machine_id", "hostname", "os", "arch", "bridge_version", "gpu", "runtime", "suggested_name"] as const;

export function parseStartBody(body: unknown): { fields?: StartFields; error?: string } {
  const b = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  const f: Record<string, unknown> = {};
  for (const k of STRING_FIELDS) {
    const v = b[k];
    if (v === undefined || v === null || v === "") { f[k] = null; continue; }
    if (typeof v !== "string" || v.length > 128) return { error: `${k} must be a string of at most 128 characters` };
    f[k] = v.trim();
  }
  if (f.suggested_name) {
    const s = sanitizeName(f.suggested_name as string);
    if (!NAME_RE.test(s)) return { error: "suggested_name is not a valid garage name" };
    f.suggested_name = s;
  }
  if (b.memory_gb === undefined || b.memory_gb === null) f.memory_gb = null;
  else if (typeof b.memory_gb !== "number" || !Number.isInteger(b.memory_gb) || b.memory_gb < 0 || b.memory_gb > 1_000_000) return { error: "memory_gb must be an integer" };
  else f.memory_gb = b.memory_gb;
  if (b.models === undefined || b.models === null) f.models = [];
  else if (!Array.isArray(b.models) || b.models.length > 50 || b.models.some((m) => typeof m !== "string" || m.length > 200)) return { error: "models must be at most 50 strings of at most 200 characters" };
  else f.models = b.models;
  if (b.transport === undefined || b.transport === null || b.transport === "") f.transport = "netbird";
  else if (b.transport !== "netbird" && b.transport !== "tunnel") return { error: "transport must be tunnel or netbird" };
  else f.transport = b.transport;
  return { fields: f as unknown as StartFields };
}

export type LinkStatus = "pending" | "approved" | "denied" | "picked_up" | "expired";
export interface LinkRow { status: LinkStatus; expires_at: string; last_poll_at: string | null; credentials: Record<string, unknown> | null; garage: { id: string; name: string } | null }
export interface PollDecision { body: Record<string, unknown>; patch: Record<string, unknown>; pickup?: boolean }

/** Decide the poll answer and the row update. Approved credentials are handed out once (caller makes the update conditional). */
export function decidePoll(row: LinkRow, now: number): PollDecision {
  const at = new Date(now).toISOString();
  if (row.status === "picked_up") return { body: { status: "picked_up" }, patch: {} };
  if (row.status === "denied") return { body: { status: "denied" }, patch: { last_poll_at: at } };
  if (row.status === "expired" || now > new Date(row.expires_at).getTime()) return { body: { status: "expired" }, patch: { status: "expired", credentials: null, last_poll_at: at } };
  if (row.last_poll_at && now - new Date(row.last_poll_at).getTime() < SLOW_DOWN_MS) return { body: { status: "slow_down" }, patch: { last_poll_at: at } };
  if (row.status === "approved" && row.credentials && row.garage) {
    const c = row.credentials;
    return {
      body: { status: "approved", garage: row.garage, register_url: c.register_url, register_token: c.register_token, setup_key: c.setup_key ?? null, management_url: c.management_url },
      patch: { status: "picked_up", credentials: null, picked_up_at: at, last_poll_at: at },
      pickup: true,
    };
  }
  return { body: { status: "pending" }, patch: { last_poll_at: at } };
}

/** A garage linked to one machine can only move to another one with an explicit replace. */
export function machineConflict(garageMachineId: string | null | undefined, requestMachineId: string | null | undefined, replace: boolean): "ok" | "replace" | "mismatch" {
  if (!garageMachineId || !requestMachineId || garageMachineId === requestMachineId) return "ok";
  return replace ? "replace" : "mismatch";
}

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const parseMachineId = (v: unknown) => typeof v === "string" && v.trim() && v.length <= 128 ? v.trim() : null;

/** Trust on first use: a garage with no machine_id adopts the reporting machine; an existing one never changes. */
export const claimMachineId = (existing: string | null, incoming: string | null): { machine_id?: string; last_machine_id?: string } => {
  if (!incoming) return {};
  if (!existing) return { machine_id: incoming, last_machine_id: incoming };
  return { last_machine_id: incoming };
};

export const WEB_ENTRY_WINDOW_MS = 60 * 60 * 1000;
/** "web" when the approving operator saw /connect within the hour before approval, otherwise "terminal". */
export function entryFor(connectPageSeenAt: string | null | undefined, approvedAt: number): "web" | "terminal" {
  if (!connectPageSeenAt) return "terminal";
  const seen = new Date(connectPageSeenAt).getTime();
  return seen <= approvedAt && approvedAt - seen <= WEB_ENTRY_WINDOW_MS ? "web" : "terminal";
}

/** Setup key on link approval: never for Bridge tunnel links; otherwise when the garage has no peer or the machine is replaced. */
export const linkWantsSetupKey = (transport: string | null | undefined, hasPeer: boolean, conflict: "ok" | "replace" | "mismatch") =>
  transport === "tunnel" ? false : !hasPeer || conflict === "replace";
