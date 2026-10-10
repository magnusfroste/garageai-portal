import type { OnboardingEvent, OnboardingStatus } from "@/models/types/onboarding.types";

export type StepState = "pending" | "running" | "done" | "failed" | "warning" | "waiting";
export interface ProgressStep { index: number; label: string; state: StepState; message: string | null; hint: string | null; at: string | null; }

export const TOTAL_STEPS = 6;

/** "3/6  Inference runtime (vllm, port 8000)" → 3; null when not parseable. */
export const stepNumber = (step: string): number | null => {
  const m = /^\s*(\d+)\s*\/\s*(\d+)/.exec(step);
  return m ? Number(m[1]) : null;
};
export const stepLabel = (step: string) => step.replace(/^\s*\d+\s*\/\s*\d+\s*/, "").trim() || step;

const HINTS: Record<number, string> = {
  1: "NetBird could not be installed; install it from netbird.io and run the command again.",
  2: "The setup key may be used or expired: click New command and run the new one.",
  3: "No OpenAI-compatible runtime answered on the port. Start it bound to 0.0.0.0, e.g. vLLM: vllm serve <model> --host 0.0.0.0 --port 8000 · Ollama: OLLAMA_HOST=0.0.0.0 ollama serve · LM Studio: enable 'Serve on local network'. Then run the command again.",
  4: "The runtime only listens on 127.0.0.1; restart it bound to 0.0.0.0.",
};
export const stepHint = (n: number): string | null => HINTS[n] ?? null;

const stateFor = (status: OnboardingStatus, isLatest: boolean, laterStarted: boolean): StepState => {
  if (status === "done") return "done";
  if (status === "failed") return "failed";
  if (status === "stopped") return "waiting";
  if (status === "warning") return laterStarted ? "warning" : isLatest ? "warning" : "warning";
  return laterStarted ? "done" : isLatest ? "running" : "running";
};

/** Builds steps 0..6 from events (any order). Uses the newest event of the current run per step. */
export const buildProgress = (events: OnboardingEvent[]): { steps: ProgressStep[]; done: boolean; latest: OnboardingEvent | null } => {
  const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const latest = sorted[sorted.length - 1] ?? null;
  // Only the latest run: start from the last time step 0 (or the lowest step) began.
  let start = 0;
  for (let i = sorted.length - 1; i >= 0; i--) { const n = stepNumber(sorted[i].step); if (n === 0 && sorted[i].status === "started") { start = i; break; } }
  const run = sorted.slice(start);
  const byStep = new Map<number, OnboardingEvent>();
  for (const e of run) { const n = stepNumber(e.step); if (n != null) byStep.set(n, e); }
  const maxStarted = Math.max(-1, ...[...byStep.keys()]);
  const latestN = latest ? stepNumber(latest.step) : null;
  const done = latest?.status === "done";
  const steps: ProgressStep[] = [];
  for (let i = 0; i <= TOTAL_STEPS; i++) {
    const e = byStep.get(i);
    if (!e) { steps.push({ index: i, label: "", state: done && i < (latestN ?? 0) ? "done" : "pending", message: null, hint: null, at: null }); continue; }
    const state = stateFor(e.status, latestN === i, maxStarted > i);
    steps.push({ index: i, label: stepLabel(e.step), state, message: e.message, hint: state === "failed" || state === "waiting" ? stepHint(i) : null, at: e.created_at });
  }
  return { steps, done, latest };
};

/** Admin badge text: "Onboarding · stuck at 3/6" / "Onboarding · 2/6 running"; null for registered garages or no events. */
export const onboardingBadge = (lastRegisteredAt: string | null, latest: OnboardingEvent | null | undefined): { label: string; stuck: boolean; step: string } | null => {
  if (lastRegisteredAt || !latest) return null;
  const n = stepNumber(latest.step);
  const step = n == null ? latest.step : `${n}/${TOTAL_STEPS}`;
  const stuck = latest.status === "failed" || latest.status === "stopped";
  if (latest.status === "done") return { label: "Onboarding · done", stuck: false, step };
  return { label: stuck ? "Onboarding · stuck at {step}" : "Onboarding · {step} running", stuck, step };
};
