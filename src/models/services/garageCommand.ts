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
    "curl -fsSLO https://raw.githubusercontent.com/magnusfroste/garageai/main/scripts/garageai-connect.sh",
  ];
  const parts = [`${opts.sudo ? "sudo " : ""}bash garageai-connect.sh`];
  if (result.setup_key) {
    parts.push(`--setup-key ${result.setup_key}`, `--management-url ${result.management_url}`);
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
  if (["vllm", "sglang", "paddock", "unsloth", "lemonade"].includes(runtime)) {
    parts.push("--runtime-api-key <DIN_NYCKEL>");
  }
  lines.push(parts.join(" \\\n  "));
  return lines.join("\n");
};

export const GARAGE_NAME_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

export const suggestGarageName = (email?: string | null): string => {
  const base = (email?.split("@")[0] || "min")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "min";
  const suffix = Math.random().toString(36).slice(2, 6);
  const name = `${base}-gpu-${suffix}`;
  return GARAGE_NAME_RE.test(name) ? name : `garage-${suffix}`;
};
