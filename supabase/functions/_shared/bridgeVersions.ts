import { valid, lt } from "npm:semver@7.8.5";

export const bridgeVersion = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const version = valid(raw.trim().replace(/^bridge-/, ""));
  return version ? `v${version}` : null;
};
export const bridgeVersionsSummary = (setting: unknown, garages: Array<{ name: string; agent?: { version?: unknown } | null }>) => {
  const s = setting && typeof setting === "object" ? setting as Record<string, unknown> : {};
  const pinned = bridgeVersion(s.pinned), latest = pinned ?? bridgeVersion(s.version);
  return { latest, pinned, garages: garages.map((g) => {
    const version = bridgeVersion(g.agent?.version);
    return { name: g.name, version, outdated: !!version && !!latest && lt(version, latest) };
  }) };
};
export const newestBridgeRelease = (releases: Array<{ tag_name: string; draft: boolean; published_at?: string | null; created_at?: string }>) => {
  const release = releases.filter((r) => !r.draft && r.tag_name.startsWith("bridge-v") && bridgeVersion(r.tag_name))
    .sort((a,b) => Date.parse(b.published_at ?? b.created_at ?? "") - Date.parse(a.published_at ?? a.created_at ?? ""))[0];
  return release ? { version: bridgeVersion(release.tag_name), tag: release.tag_name } : null;
};