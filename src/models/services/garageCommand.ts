export interface GarageCredentials {
  garage: { id: string; name: string };
  register_token: string;
  setup_key: string | null;
  register_url: string;
  management_url: string;
}

export interface BuildCommandOptions {
  /** Run the script with sudo (Linux), preserving the exported secrets. */
  sudo?: boolean;
  port?: number;
  /** Models passed as --models (wizard choice, or the offered models on a rerun). */
  models?: string[];
}

const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

/** Builds the connect command (zsh- and bash-safe): download, export secrets, run. Without a setup key it is a --skip-install rerun. */
export const buildGarageCommand = (
  result: GarageCredentials,
  runtime: string,
  opts: BuildCommandOptions = {}
): string => {
  const env: Array<[string, string]> = [];
  if (result.setup_key) env.push(["GARAGEAI_SETUP_KEY", shellQuote(result.setup_key)]);
  env.push(["GARAGEAI_REGISTER_TOKEN", shellQuote(result.register_token)]);
  if (["vllm", "sglang", "paddock", "unsloth", "lemonade"].includes(runtime)) env.push(["GARAGEAI_RUNTIME_API_KEY", "'<YOUR_KEY>'"]);
  const lines = [
    "curl -fsSLO https://raw.githubusercontent.com/magnusfroste/garageai/main/scripts/garageai-connect.sh",
    `export ${env.map(([k, v]) => `${k}=${v}`).join(" ")}`,
  ];
  const run = opts.sudo ? `sudo --preserve-env=${env.map(([k]) => k).join(",")} bash garageai-connect.sh` : "bash garageai-connect.sh";
  const parts = [run];
  if (!result.setup_key) parts.push("--skip-install");
  parts.push(`--runtime ${runtime}`, `--name ${result.garage.name}`);
  const models = (opts.models ?? []).filter(Boolean);
  if (models.length) parts.push(`--models ${shellQuote(models.join(","))}`);
  parts.push(`--register-url ${result.register_url}`);
  if (result.setup_key) parts.push(`--management-url ${result.management_url}`);
  if (runtime === "other" && opts.port) parts.push(`--port ${opts.port}`);
  lines.push(parts.join(" \\\n  "));
  return lines.join("\n");
};

export const GARAGE_NAME_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

const GARAGE_ADJECTIVES = ["amber", "bright", "calm", "clear", "green", "quiet", "swift", "warm"];

export const suggestGarageName = (): string => {
  const adjective = GARAGE_ADJECTIVES[Math.floor(Math.random() * GARAGE_ADJECTIVES.length)];
  const suffix = Math.random().toString(36).slice(2, 6);
  const name = `garage-${adjective}-${suffix}`;
  return GARAGE_NAME_RE.test(name) ? name : `garage-${suffix}`;
};
