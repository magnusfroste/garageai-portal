import { valid, lt } from "npm:semver@7.8.5";

export const bridgeVersion = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const version = valid(raw.trim().replace(/^bridge-/, ""));
  return version ? `v${version}` : null;
};
export const bridgeVersionsSummary = (setting: unknown, garages: Array<{ name: string; agent?: { version?: unknown; update?: { auto?: unknown; last_error?: unknown } } | null }>, update?: unknown) => {
  const s = setting && typeof setting === "object" ? setting as Record<string, unknown> : {};
  const u = update && typeof update === "object" ? update as Record<string, unknown> : {};
  const pinned = bridgeVersion(s.pinned), stable = bridgeVersion(u.stable), mode = u.mode === "manual" ? "manual" : "auto";
  // Outdated = behind what garages should run: stable, else pin, else latest release.
  const latest = bridgeVersion(s.version), target = stable ?? pinned ?? latest;
  return { latest, pinned, stable, mode, garages: garages.map((g) => {
    const version = bridgeVersion(g.agent?.version);
    const auto = typeof g.agent?.update?.auto === "boolean" ? g.agent.update.auto : null;
    const last_error = typeof g.agent?.update?.last_error === "string" ? g.agent.update.last_error : null;
    return { name: g.name, version, outdated: !!version && !!target && lt(version, target), auto, last_error };
  }) };
};
export const newestBridgeRelease = (releases: Array<{ tag_name: string; draft: boolean; published_at?: string | null; created_at?: string }>) => {
  const release = releases.filter((r) => !r.draft && r.tag_name.startsWith("bridge-v") && bridgeVersion(r.tag_name))
    .sort((a,b) => Date.parse(b.published_at ?? b.created_at ?? "") - Date.parse(a.published_at ?? a.created_at ?? ""))[0];
  return release ? { version: bridgeVersion(release.tag_name), tag: release.tag_name, published_at: release.published_at ?? release.created_at ?? null } : null;
};