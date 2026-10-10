import type { OnboardingEvent } from "@/models/types/onboarding.types";

/** The latest event is authoritative; never attribute an older run to the current one. */
export const latestConnectionTool = (events: Pick<OnboardingEvent, "created_at" | "script_version">[]): string | null => {
  const latest = events.reduce<(typeof events)[number] | null>((current, event) =>
    !current || event.created_at > current.created_at ? event : current, null);
  return connectionTool(latest?.script_version);
};

export const connectionTool = (scriptVersion: string | null | undefined): string | null => {
  const version = scriptVersion?.trim();
  if (!version) return null;
  if (/\bbridge\b/i.test(version)) {
    const clean = version.replace(/\(bridge\)/gi, "").replace(/\bbridge\b/gi, "").trim();
    return clean ? `Bridge ${clean}` : "Bridge";
  }
  return `script ${version}`;
};