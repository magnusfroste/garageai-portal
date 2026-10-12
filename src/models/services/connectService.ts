// Rules for the "Connect this computer" page and live Bridge progress after approval.
import type { OnboardingEvent } from "@/models/types/onboarding.types";
import { stepNumber } from "./onboardingProgress";

export type ConnectOs = "macos" | "linux" | "windows";
export const BRIDGE_ONE_LINE = "curl -fsSL https://raw.githubusercontent.com/magnusfroste/garageai/main/cli/install.sh | sh -s -- connect";
export const BRIDGE_NETBIRD_FLAG = " --tunnel netbird";

/** The plain command uses the Bridge tunnel (default); the NetBird variant is the fallback when the network blocks UDP. */
export const bridgeInstallCommand = (): string => BRIDGE_ONE_LINE;
export const bridgeNetbirdCommand = (): string => BRIDGE_ONE_LINE + BRIDGE_NETBIRD_FLAG;

export function detectOs(userAgent: string): ConnectOs {
  const ua = userAgent.toLowerCase();
  if (ua.includes("windows")) return "windows";
  if (/mac os|macintosh|iphone|ipad/.test(ua)) return "macos";
  return "linux";
}

export const BRIDGE_STEPS = ["NetBird client", "Join the mesh", "Inference runtime", "Reachable over the mesh", "Register (acceptance test)", "Heartbeat"] as const;
export type BridgeStepState = "pending" | "running" | "done" | "warning" | "failed";
export interface BridgeStep { index: number; label: string; state: BridgeStepState; message: string | null }

const KEYWORD: Array<[RegExp, number]> = [[/^register/i, 5], [/^heartbeat/i, 6]];
const stepIndex = (step: string): number | null => {
  const n = stepNumber(step);
  if (n != null) return n >= 1 && n <= 6 ? n : null;
  return KEYWORD.find(([re]) => re.test(step.trim()))?.[1] ?? null;
};

/** Maps onboarding events (any order) to the six Bridge steps, using only events from the latest browser link onwards. */
export function bridgeProgress(events: OnboardingEvent[]): { steps: BridgeStep[]; live: boolean; failed: BridgeStep | null } {
  const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
  let start = 0;
  for (let i = sorted.length - 1; i >= 0; i--) if (sorted[i].step === "link") { start = i; break; }
  const latest = new Map<number, OnboardingEvent>();
  for (const e of sorted.slice(start)) { const n = stepIndex(e.step); if (n != null) latest.set(n, e); }
  const maxSeen = Math.max(0, ...latest.keys());
  const steps = BRIDGE_STEPS.map((label, i): BridgeStep => {
    const e = latest.get(i + 1);
    if (!e) return { index: i + 1, label, state: i + 1 < maxSeen ? "done" : "pending", message: null };
    const state: BridgeStepState = e.status === "done" ? "done" : e.status === "failed" || e.status === "stopped" ? "failed" : e.status === "warning" ? "warning" : i + 1 < maxSeen ? "done" : "running";
    return { index: i + 1, label, state, message: e.message };
  });
  return { steps, live: steps[4].state === "done", failed: steps.find((s) => s.state === "failed") ?? null };
}
