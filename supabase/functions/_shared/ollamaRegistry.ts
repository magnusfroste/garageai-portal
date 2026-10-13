// Real Ollama download sizes from registry.ollama.ai manifests. Pure parsing + one fetch helper (unit-tested).
export const MANIFEST_ACCEPT = "application/vnd.docker.distribution.manifest.v2+json";

/** "gemma4:e4b" → /v2/library/gemma4/manifests/e4b; "user/name:tag" → /v2/user/name/manifests/tag. Null for other hosts or bad tags. */
export function manifestPath(tag: string): string | null {
  const m = /^([a-z0-9._-]+(?:\/[a-z0-9._-]+)?)(?::([A-Za-z0-9._-]+))?$/.exec(tag.trim());
  if (!m || m[1].includes(".") && m[1].includes("/")) return null; // hf.co/… etc. are not on the Ollama registry
  const name = m[1].includes("/") ? m[1] : `library/${m[1]}`;
  return `/v2/${name}/manifests/${m[2] ?? "latest"}`;
}

/** Sum of layers[].size; null when the manifest has no usable layers. */
export function manifestBytes(manifest: unknown): number | null {
  const layers = (manifest as { layers?: unknown })?.layers;
  if (!Array.isArray(layers) || !layers.length) return null;
  let sum = 0;
  for (const l of layers) {
    const s = (l as { size?: unknown })?.size;
    if (typeof s !== "number" || !Number.isFinite(s) || s < 0) return null;
    sum += s;
  }
  return sum > 0 ? sum : null;
}

export async function fetchDownloadBytes(tag: string, fetcher: typeof fetch = fetch): Promise<number | null> {
  const path = manifestPath(tag);
  if (!path) return null;
  try {
    const res = await fetcher(`https://registry.ollama.ai${path}`, { headers: { Accept: MANIFEST_ACCEPT }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return manifestBytes(await res.json());
  } catch { return null; }
}
