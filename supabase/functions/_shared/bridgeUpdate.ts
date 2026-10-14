// Bridge self-update: the portal decides the stable version garages run (admin_settings bridge_update), never GitHub directly.
import { gt, valid } from "npm:semver@7.8.5";

const v = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const s = valid(raw.trim().replace(/^bridge-/, ""));
  return s ? `v${s}` : null;
};

export type BridgeUpdateMode = "manual" | "auto";
export interface BridgeUpdateSetting { stable: string | null; mode: BridgeUpdateMode; auto_after_hours: number }

/** Defaults: mode auto, 24 h. */
export function parseBridgeUpdate(raw: unknown): BridgeUpdateSetting {
  const s = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const h = Number(s.auto_after_hours);
  return { stable: v(s.stable), mode: s.mode === "manual" ? "manual" : "auto", auto_after_hours: Number.isFinite(h) && h >= 0 ? h : 24 };
}

export const DOWNLOAD_BASE = "https://github.com/magnusfroste/garageai/releases/download";

/** Fields added to every node-heartbeat response. Canary garages get the latest release instead of stable. */
export function heartbeatBridgeFields(setting: BridgeUpdateSetting, opts: { canary?: boolean; latest?: unknown } = {}): { bridge_stable: string | null; bridge_download_base: string | null } {
  const latest = opts.canary ? v((opts.latest as { version?: unknown } | null | undefined)?.version) : null;
  const target = latest ?? setting.stable;
  return target
    ? { bridge_stable: target, bridge_download_base: `${DOWNLOAD_BASE}/bridge-${target}` }
    : { bridge_stable: null, bridge_download_base: null };
}

export const HEARTBEAT_FRESH_MS = 60 * 60 * 1000;

export interface BridgeReleaseRun { version: string; first_seen_at: string; update_errors: number }

/** When a run becomes eligible (first seen on an admin/canary garage + auto_after_hours), or null if never. */
export function eligibleAt(setting: BridgeUpdateSetting, run: BridgeReleaseRun): number | null {
  const first = Date.parse(run.first_seen_at);
  return Number.isFinite(first) && run.update_errors === 0 ? first + setting.auto_after_hours * 3600_000 : null;
}

/**
 * Auto mode: stable = the newest version first seen on one of our (admin or canary) garages at least
 * auto_after_hours ago, with no update errors, and newer than the current stable. Release age is irrelevant,
 * so several releases a day still promote in order.
 */
export function pickStable(setting: BridgeUpdateSetting, runs: BridgeReleaseRun[], now = Date.now()): string | null {
  if (setting.mode !== "auto") return null;
  let best: string | null = null;
  for (const r of runs) {
    const ver = v(r.version); const at = eligibleAt(setting, r);
    if (!ver || at === null || at > now) continue;
    if (setting.stable && !gt(ver, setting.stable)) continue;
    if (!best || gt(ver, best)) best = ver;
  }
  return best;
}

/** Which version an update error is about: the target the garage was offered, when it is not already running it. */
export const updateErrorVersion = (running: unknown, target: string | null, error: unknown): string | null =>
  typeof error === "string" && error && target && v(running) !== target ? target : null;
