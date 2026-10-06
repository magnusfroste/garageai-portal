import type { DemandModel } from "@/data/repositories/garageRepository";

export const demandModelId = (entry: DemandModel, runtime: string): string => {
  if (runtime === "ollama") return entry.ids?.ollama || entry.model;
  if (runtime === "lmstudio") return entry.ids?.lmstudio || "";
  if (["vllm", "sglang", "unsloth", "mlx"].includes(runtime)) return entry.ids?.[runtime] || entry.ids?.hf || "";
  return entry.ids?.[runtime] || "";
};