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

/**
 * Auto mode promotes the latest release to stable when it is newer than stable, at least
 * auto_after_hours old (from published_at), and at least one garage already runs it with a heartbeat in the last hour.
 */
export function shouldPromote(
  setting: BridgeUpdateSetting,
  latest: { version?: unknown; published_at?: unknown } | null | undefined,
  garages: Array<{ agent?: { version?: unknown } | null; last_heartbeat_at?: string | null }>,
  now = Date.now(),
): string | null {
  if (setting.mode !== "auto") return null;
  const candidate = v(latest?.version);
  if (!candidate) return null;
  if (setting.stable && !gt(candidate, setting.stable)) return null;
  const published = typeof latest?.published_at === "string" ? Date.parse(latest.published_at) : NaN;
  if (!Number.isFinite(published) || now - published < setting.auto_after_hours * 3600_000) return null;
  const running = garages.some((g) => v(g.agent?.version) === candidate && !!g.last_heartbeat_at && now - Date.parse(g.last_heartbeat_at) <= HEARTBEAT_FRESH_MS);
  return running ? candidate : null;
}
