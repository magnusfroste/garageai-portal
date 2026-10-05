export type GarageOs = "macos" | "linux" | "windows";
export type GarageRuntime = "ollama" | "lmstudio" | "llamacpp" | "vllm";

export const OS_OPTIONS: Array<{ value: GarageOs; label: string; supported: boolean }> = [
  { value: "macos", label: "macOS", supported: true },
  { value: "linux", label: "Linux", supported: true },
  { value: "windows", label: "Windows (inte stöd än)", supported: false },
];

export const RUNTIME_OPTIONS: Array<{ value: GarageRuntime; label: string; port: number }> = [
  { value: "ollama", label: "Ollama", port: 11434 },
  { value: "lmstudio", label: "LM Studio", port: 1234 },
  { value: "llamacpp", label: "llama.cpp", port: 8080 },
  { value: "vllm", label: "vLLM", port: 8000 },
];

export interface PrepStep {
  text: string;
  code?: string;
}

/** Instructions so the runtime listens on all interfaces. */
export const prepSteps = (os: GarageOs, runtime: GarageRuntime): PrepStep[] => {
  switch (runtime) {
    case "ollama":
      return os === "macos"
        ? [
            { text: "Låt Ollama lyssna på alla nätverksgränssnitt:", code: "launchctl setenv OLLAMA_HOST 0.0.0.0" },
            { text: "Starta sedan om Ollama-appen (avsluta i menyraden och öppna igen)." },
          ]
        : [
            { text: "Öppna Ollamas tjänsteinställningar:", code: "sudo systemctl edit ollama" },
            { text: "Lägg till följande och spara:", code: '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0"' },
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
  }
};
