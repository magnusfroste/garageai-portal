export interface GarageCredentials {
  garage: { id: string; name: string };
  register_token: string;
  setup_key: string | null;
  register_url: string;
  management_url: string;
}

export interface BuildCommandOptions {
  /** Prefix the script invocation with sudo (Linux). */
  sudo?: boolean;
  port?: number;
}

/** Builds the one-time connect command shown after create-garage. */
export const buildGarageCommand = (
  result: GarageCredentials,
  runtime: string,
  opts: BuildCommandOptions = {}
): string => {
  const lines = [
    "curl -fsSLo garageai-connect.sh https://raw.githubusercontent.com/magnusfroste/garageai/main/scripts/garageai-connect.sh",
  ];
  const env = [`GARAGEAI_REGISTER_TOKEN=${result.register_token}`];
  if (result.setup_key) env.push(`GARAGEAI_SETUP_KEY=${result.setup_key}`);
  if (["vllm", "sglang", "paddock", "unsloth", "lemonade"].includes(runtime)) {
    env.push("GARAGEAI_RUNTIME_API_KEY=<YOUR_KEY>");
  }
  const parts = [`${env.join(" ")} ${opts.sudo ? "sudo " : ""}bash garageai-connect.sh`];
  if (result.setup_key) {
    parts.push(`--management-url ${result.management_url}`);
  } else {
    parts.push("--skip-install");
  }
  parts.push(
    `--runtime ${runtime}`,
    `--name ${result.garage.name}`,
    `--register-url ${result.register_url}`,
    `--register-token ${result.register_token}`
  );
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
