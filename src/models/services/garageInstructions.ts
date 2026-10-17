import {
  GARAGE_RUNTIME_OPTIONS,
  OFFICIAL_RUNTIMES,
  OTHER_RUNTIMES,
  type GarageRuntime,
} from "./garageRuntime";
import { t } from "@/i18n";

export type GarageOs = "macos" | "linux" | "windows";
export type { GarageRuntime } from "./garageRuntime";

export const OS_OPTIONS: Array<{ value: GarageOs; label: string; supported: boolean }> = [
  { value: "macos", label: "macOS", supported: true },
  { value: "linux", label: "Linux", supported: true },
  { value: "windows", label: "Windows", supported: true },
];

export const RUNTIME_OPTIONS = GARAGE_RUNTIME_OPTIONS;
export { OFFICIAL_RUNTIMES, OTHER_RUNTIMES };

export interface PrepStep {
  text: string;
  code?: string;
}

export const RAM_BUCKETS = [
  { value: 8, label: "8 GB" },
  { value: 16, label: "16 GB" },
  { value: 24, label: "24–32 GB" },
  { value: 64, label: "64+ GB" },
] as const;

/** Pull instruction for the chosen model and runtime. */
export const pullStep = (runtime: GarageRuntime, model: string): PrepStep | null => {
  if (!model) return null;
  if (runtime === "ollama") return { text: t("Download the model:"), code: `ollama pull ${model}` };
  if (runtime === "lmstudio") return { text: t("Search for {model} in LM Studio's Discover tab and download it.", { model }) };
  return { text: t("Load {model} in your runtime.", { model }) };
};

