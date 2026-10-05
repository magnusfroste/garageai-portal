
import { t } from "@/i18n";export interface GarageToolSupport {
  garage_name: string;
  model: string;
  supports_tools: boolean;
}

/** Mirrors the chat backend: "garage/<g>/<m>" checks that garage; a pool name checks any garage serving it. */
export const modelSupportsTools = (rows: GarageToolSupport[], modelId: string): boolean => {
  const m = modelId.match(/^garage\/([^/]+)\/(.+)$/);
  if (m) return rows.some((r) => r.garage_name === m[1] && r.model === m[2] && r.supports_tools);
  return rows.some((r) => r.model === modelId && r.supports_tools);
};

export type ToolHintRuntime = string | null | undefined;

/** Operator-facing fix hint when the tool probe fails, per inference engine. */
export const toolSupportHint = (runtime: ToolHintRuntime): string | null => {
  switch (runtime) {
    case "vllm": return t("Start with --enable-auto-tool-choice --tool-call-parser <parser>");
    case "sglang": return t("Start with --tool-call-parser <parser>");
    case "llamacpp": return t("Start llama-server with --jinja");
    case "ollama": return t("The model must support tools");
    case "lmstudio": return t("Choose a model with tool use support");
    default: return null;
  }
};
