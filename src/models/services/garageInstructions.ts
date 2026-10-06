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
  { value: "windows", label: "Windows (not supported yet)", supported: false },
];

export const RUNTIME_OPTIONS = GARAGE_RUNTIME_OPTIONS;
export { OFFICIAL_RUNTIMES, OTHER_RUNTIMES };

export interface PrepStep {
  text: string;
  code?: string;
}

/** Instructions so the runtime listens on all interfaces. */
export type OllamaMacMethod = "app" | "brew";

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

export const prepSteps = (os: GarageOs, runtime: GarageRuntime, port?: number, macMethod: OllamaMacMethod = "app"): PrepStep[] => {
  switch (runtime) {
    case "ollama":
      return os === "macos"
        ? macMethod === "brew"
          ? [
              { text: t("Let Ollama listen on all network interfaces and serve several buyers at once:"), code: "launchctl setenv OLLAMA_HOST 0.0.0.0\nlaunchctl setenv OLLAMA_NUM_PARALLEL 4" },
              { text: t("Restart the Homebrew service:"), code: "brew services restart ollama" },
              { text: t("The connect script will offer to make OLLAMA_HOST permanent on macOS.") },
            ]
          : [
              { text: t("Let Ollama listen on all network interfaces and serve several buyers at once:"), code: "launchctl setenv OLLAMA_HOST 0.0.0.0\nlaunchctl setenv OLLAMA_NUM_PARALLEL 4" },
              { text: t("Then restart the Ollama app (quit from the menu bar and open it again).") },
              { text: t("The connect script will offer to make OLLAMA_HOST permanent on macOS.") },
            ]
        : [
            { text: t("Open Ollama's service settings:"), code: "sudo systemctl edit ollama" },
            { text: t("Add the following and save:"), code: '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0"\nEnvironment="OLLAMA_NUM_PARALLEL=4"' },
            { text: t("Restart the service:"), code: "sudo systemctl restart ollama" },
          ];
    case "lmstudio":
      return [
        { text: t("Open the Developer tab in LM Studio and start the server.") },
        { text: t("Enable \"Serve on local network\" and check that the port is 1234.") },
      ];
    case "llamacpp":
      return [{ text: t("Start llama-server so it listens on all interfaces:"), code: "llama-server -m <your-model.gguf> --host 0.0.0.0 --port 8080" }];
    case "vllm":
      return [
        { text: t("Start vLLM so it listens on all interfaces:"), code: "vllm serve <model> --host 0.0.0.0 --port 8000" },
        { text: t("If you start with --api-key, note the key – you will need it in the command in the next step.") },
      ];
    case "sglang":
      return [
        { text: t("Start SGLang on port 30000. Add --api-key KEY if you want to protect the runtime:"), code: "python -m sglang.launch_server --model-path <model> --host 0.0.0.0 --port 30000 [--api-key KEY]" },
      ];
    case "paddock":
      return [
        { text: t("Start Paddock with an API key. The key is always required when Paddock listens on the network:"), code: "paddock-runner --model /path/model.gguf --host 0.0.0.0 --port 11540 --api-key KEY" },
      ];
    case "unsloth":
      return [
        { text: t("Start the Unsloth server:"), code: "unsloth run --model <repo>:<kvant> -H 0.0.0.0 -p 8888 --disable-tools" },
        { text: t("Create an API key under Settings → API. You can also export the model to GGUF and choose llama.cpp or Ollama.") },
      ];
    case "mlx":
      return [
        { text: t("Start the MLX server. No API key is needed:"), code: "mlx_lm.server --model <model> --host 0.0.0.0 --port 8080" },
      ];
    case "lemonade":
      return [
        { text: t("Start Lemonade with an optional API key:"), code: "LEMONADE_API_KEY=KEY lemond --host 0.0.0.0 --port 13305" },
      ];
    case "other":
      return [
        { text: t("Start your OpenAI-compatible server on all network interfaces and port {port}.", { port: port === 8080 ? 8080 : 8000 }) },
        { text: t("Check that the server offers an OpenAI-compatible API under /v1.") },
      ];
  }
};
