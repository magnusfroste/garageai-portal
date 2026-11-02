/** One-paste OpenCode setup line (macOS/Linux). Pure: the key is only interpolated, never stored. */
export function opencodeSetupCommand(key: string): string {
  return `d="$HOME/.config/opencode"; mkdir -p "$d"; if [ -e "$d/opencode.json" ]; then curl -fsSL https://app.garageai.eu/opencode.json -o "$d/garageai.json" && echo "You already have $d/opencode.json: copy the providers.garageai block from $d/garageai.json into it."; else curl -fsSL https://app.garageai.eu/opencode.json -o "$d/opencode.json"; fi; opencode service set env GARAGE_API_KEY '${key}' && opencode service restart && opencode run -m garageai/auto "Say hello in one sentence."`;
}
