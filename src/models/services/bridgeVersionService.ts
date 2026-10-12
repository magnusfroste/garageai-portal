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
export const effectiveBridgeVersion = (s: BridgeLatest) => s.pinned ?? s.version;
export const bridgeStatus = (raw: unknown, s: BridgeLatest) => {
  const version = bridgeVersion(raw), latest = effectiveBridgeVersion(s);
  return { version, latest, outdated: !!version && !!latest && lt(version, latest) };
};
export const BRIDGE_UPDATE_COMMAND = "curl -fsSL https://raw.githubusercontent.com/magnusfroste/garageai/main/cli/install.sh | sh";