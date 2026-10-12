import { valid, lt } from "semver";

export interface BridgeLatest { version: string | null; tag: string | null; checked_at: string | null; pinned: string | null }
export const bridgeVersion = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const v = valid(raw.trim().replace(/^bridge-/, ""));
  return v ? `v${v}` : null;
};
export const parseBridgeLatest = (raw: unknown): BridgeLatest => {
  const s = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return { version: bridgeVersion(s.version), pinned: bridgeVersion(s.pinned), tag: typeof s.tag === "string" ? s.tag : null, checked_at: typeof s.checked_at === "string" ? s.checked_at : null };
};
/** Target version garages should run: the portal's stable (bridge_update), else pin, else latest release. */
export const effectiveBridgeVersion = (s: BridgeLatest, stable?: string | null) => stable ?? s.pinned ?? s.version;
export interface BridgeUpdate { stable: string | null; mode: "manual" | "auto"; auto_after_hours: number }
export const parseBridgeUpdate = (raw: unknown): BridgeUpdate => {
  const s = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const h = Number(s.auto_after_hours);
  return { stable: bridgeVersion(s.stable), mode: s.mode === "manual" ? "manual" : "auto", auto_after_hours: Number.isFinite(h) && h >= 0 ? h : 24 };
};
export type BridgeUpdateState = { kind: "none" } | { kind: "current"; version: string } | { kind: "updating"; version: string; target: string } | { kind: "failed"; version: string | null; error: string } | { kind: "off"; version: string | null };
/** Admin Bridge column: failed > auto-update off > updating > version. */
export const bridgeUpdateState = (agent: { version?: unknown; update?: { auto?: boolean; last_error?: string | null } } | null | undefined, stable: string | null): BridgeUpdateState => {
  const version = bridgeVersion(agent?.version);
  const u = agent?.update;
  if (u?.last_error) return { kind: "failed", version, error: u.last_error };
  if (u && u.auto === false) return { kind: "off", version };
  if (!version) return { kind: "none" };
  if (u?.auto === true && stable && version !== stable) return { kind: "updating", version, target: stable };
  return { kind: "current", version };
};
export const bridgeStatus = (raw: unknown, s: BridgeLatest, stable?: string | null) => {
  const version = bridgeVersion(raw), latest = effectiveBridgeVersion(s, stable);
  return { version, latest, outdated: !!version && !!latest && lt(version, latest) };
};
export const BRIDGE_UPDATE_COMMAND = "curl -fsSL https://raw.githubusercontent.com/magnusfroste/garageai/main/cli/install.sh | sh";