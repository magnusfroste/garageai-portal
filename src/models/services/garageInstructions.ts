import {
  GARAGE_RUNTIME_OPTIONS,
  OFFICIAL_RUNTIMES,
  OTHER_RUNTIMES,
  type GarageRuntime,
} from "./garageRuntime";

export type GarageOs = "macos" | "linux" | "windows";
export type { GarageRuntime } from "./garageRuntime";

export const OS_OPTIONS: Array<{ value: GarageOs; label: string; supported: boolean }> = [
  { value: "macos", label: "macOS", supported: true },
  { value: "linux", label: "Linux", supported: true },
  { value: "windows", label: "Windows (inte stöd än)", supported: false },
];

export const RUNTIME_OPTIONS = GARAGE_RUNTIME_OPTIONS;
export { OFFICIAL_RUNTIMES, OTHER_RUNTIMES };

export interface PrepStep {
  text: string;
  code?: string;
}

/** Instructions so the runtime listens on all interfaces. */
export const prepSteps = (os: GarageOs, runtime: GarageRuntime, port?: number): PrepStep[] => {
  switch (runtime) {
    case "ollama":
      return os === "macos"
        ? [
            { text: "Låt Ollama lyssna på alla nätverksgränssnitt och hantera flera köpare samtidigt:", code: "launchctl setenv OLLAMA_HOST 0.0.0.0\nlaunchctl setenv OLLAMA_NUM_PARALLEL 4" },
            { text: "Starta sedan om Ollama-appen (avsluta i menyraden och öppna igen)." },
          ]
        : [
            { text: "Öppna Ollamas tjänsteinställningar:", code: "sudo systemctl edit ollama" },
            { text: "Lägg till följande och spara:", code: '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0"\nEnvironment="OLLAMA_NUM_PARALLEL=4"' },
            { text: "Starta om tjänsten:", code: "sudo systemctl restart ollama" },
          ];
    case "lmstudio":
      return [
        { text: "Öppna fliken Developer i LM Studio och starta servern." },
        { text: "Aktivera \"Serve on local network\" och kontrollera att porten är 1234." },
      ];
    case "llamacpp":
      return [{ text: "Starta llama-server så att den lyssnar på alla gränssnitt:", code: "llama-server -m <din-modell.gguf> --host 0.0.0.0 --port 8080" }];
    case "vllm":
      return [
        { text: "Starta vLLM så att den lyssnar på alla gränssnitt:", code: "vllm serve <modell> --host 0.0.0.0 --port 8000" },
        { text: "Om du startar med --api-key, notera nyckeln – du behöver den i kommandot i nästa steg." },
      ];
    case "sglang":
      return [
        { text: "Starta SGLang på port 30000. Lägg till --api-key NYCKEL om du vill skydda runtimen:", code: "python -m sglang.launch_server --model-path <modell> --host 0.0.0.0 --port 30000 [--api-key NYCKEL]" },
      ];
    case "paddock":
      return [
        { text: "Starta Paddock med en API-nyckel. Nyckeln krävs alltid när Paddock lyssnar på nätverket:", code: "paddock-runner --model /sökväg/modell.gguf --host 0.0.0.0 --port 11540 --api-key NYCKEL" },
      ];
    case "unsloth":
      return [
        { text: "Starta Unsloth-servern:", code: "unsloth run --model <repo>:<kvant> -H 0.0.0.0 -p 8888 --disable-tools" },
        { text: "Skapa en API-nyckel under Settings → API. Du kan också exportera modellen till GGUF och välja llama.cpp eller Ollama." },
      ];
    case "mlx":
      return [
        { text: "Starta MLX-servern. Ingen API-nyckel behövs:", code: "mlx_lm.server --model <modell> --host 0.0.0.0 --port 8080" },
      ];
    case "lemonade":
      return [
        { text: "Starta Lemonade med valfri API-nyckel:", code: "LEMONADE_API_KEY=NYCKEL lemond --host 0.0.0.0 --port 13305" },
      ];
    case "other":
      return [
        { text: `Starta din OpenAI-kompatibla server på alla nätverksgränssnitt och port ${port === 8080 ? 8080 : 8000}.` },
        { text: "Kontrollera att servern erbjuder ett OpenAI-kompatibelt API under /v1." },
      ];
  }
};
