export type GarageRuntime =
  | "ollama"
  | "lmstudio"
  | "llamacpp"
  | "vllm"
  | "sglang"
  | "paddock"
  | "unsloth"
  | "mlx"
  | "lemonade"
  | "other";

export interface GarageRuntimeOption {
  value: GarageRuntime;
  label: string;
  port: number;
  group: "official" | "other";
  beta?: boolean;
  description?: string;
}

export const GARAGE_RUNTIME_OPTIONS: GarageRuntimeOption[] = [
  { value: "ollama", label: "Ollama", port: 11434, group: "official" },
  { value: "lmstudio", label: "LM Studio", port: 1234, group: "official" },
  { value: "llamacpp", label: "llama.cpp", port: 8080, group: "official" },
  { value: "vllm", label: "vLLM", port: 8000, group: "official" },
  { value: "sglang", label: "SGLang", port: 30000, group: "official" },
  { value: "paddock", label: "Paddock", port: 11540, group: "official", beta: true, description: "Ny svensk inferensmotor (Truespar). En GPU i taget." },
  { value: "unsloth", label: "Unsloth", port: 8888, group: "other" },
  { value: "mlx", label: "MLX för Apple Silicon", port: 8080, group: "other" },
  { value: "lemonade", label: "Lemonade för AMD", port: 13305, group: "other" },
  { value: "other", label: "Annan OpenAI-kompatibel server", port: 8000, group: "other" },
];

export const OFFICIAL_RUNTIMES = GARAGE_RUNTIME_OPTIONS.filter((runtime) => runtime.group === "official");
export const OTHER_RUNTIMES = GARAGE_RUNTIME_OPTIONS.filter((runtime) => runtime.group === "other");
export const RUNTIMES_WITH_API_KEY: GarageRuntime[] = ["vllm", "sglang", "paddock", "unsloth", "lemonade"];

export const runtimeOption = (runtime?: string | null) =>
  GARAGE_RUNTIME_OPTIONS.find((option) => option.value === runtime);

export const runtimeLabel = (runtime?: string | null): string => {
  if (!runtime) return "Okänd runtime";
  const option = runtimeOption(runtime);
  return option ? `${option.label}${option.beta ? " (beta)" : ""}` : runtime;
};