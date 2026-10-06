// Model identity: runtime id (what the runtime reports / what we send upstream) vs
// canonical model (catalogue name + pool route), in OpenRouter style `<creator>/<model>`.
// Pure module: also imported by the web app. Must stay identical to SQL public.normalise_model_id.

/** Runtime org prefix → OpenRouter creator slug. "" = repackager: drop it and use the family rule. */
export const ORG_CREATORS: Record<string, string> = {
  "qwen": "qwen", "meta-llama": "meta-llama", "google": "google", "mistralai": "mistralai",
  "deepseek-ai": "deepseek", "nvidia": "nvidia", "xiaomimimo": "xiaomi", "xiaomi": "xiaomi",
  "microsoft": "microsoft", "zai-org": "z-ai", "thudm": "z-ai",
  "unsloth": "", "lmstudio-community": "", "bartowski": "", "mlx-community": "", "ollama": "",
};

/** Leading model-family token → creator slug, for ids without an org prefix. First match wins. */
export const FAMILY_CREATORS: Array<[string, string]> = [
  ["qwen", "qwen"], ["llama", "meta-llama"], ["gemma", "google"], ["mistral", "mistralai"],
  ["mixtral", "mistralai"], ["deepseek", "deepseek"], ["nemotron", "nvidia"], ["mimo", "xiaomi"],
  ["phi", "microsoft"], ["glm", "z-ai"], ["gpt-oss", "openai"], ["codestral", "mistralai"],
  ["devstral", "mistralai"], ["smollm", "huggingfacetb"],
];

/** OpenRouter-style canonical slug required for admin aliases of non-private models. */
export const CANONICAL_RE = /^[a-z0-9.-]+\/[a-z0-9._-]+$/;
/** Any safe slug, for provider-private model names. */
export const PRIVATE_SLUG_RE = /^[a-z0-9._-]+(\/[a-z0-9._-]+)?$/;

const clean = (s: string) => s.replace(/:/g, "-").replace(/-latest$/, "").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");

/**
 * lowercase, ":" → "-", strip trailing "-latest", collapse "-", trim "-" (size/quant suffixes kept);
 * then org prefix → creator via ORG_CREATORS (unknown org kept), else creator from FAMILY_CREATORS
 * (unknown family → bare name).
 */
export function normaliseModelId(runtimeId: string): string {
  const s = clean(runtimeId.toLowerCase());
  const slash = s.indexOf("/");
  const name = slash >= 0 ? s.slice(slash + 1).replace(/^-+|-+$/g, "") : s;
  if (slash >= 0) {
    const org = s.slice(0, slash);
    const creator = org in ORG_CREATORS ? ORG_CREATORS[org] : org;
    if (creator) return `${creator}/${name}`;
  }
  const fam = FAMILY_CREATORS.find(([p]) => name.startsWith(p));
  return fam ? `${fam[1]}/${name}` : name;
}

const CASES: Array<[string, string]> = [
  ["deepseek-v4-flash", "deepseek/deepseek-v4-flash"], ["qwen3-4b", "qwen/qwen3-4b"],
  ["nvidia/nemotron-3-super-120b-a12b", "nvidia/nemotron-3-super-120b-a12b"],
  ["XiaomiMiMo/MiMo-V2.6-Flash", "xiaomi/mimo-v2.6-flash"], ["mimo-v2.6-flash", "xiaomi/mimo-v2.6-flash"],
  ["meta-llama/Llama-3.1-8B-Instruct", "meta-llama/llama-3.1-8b-instruct"], ["gemma-3-4b-it", "google/gemma-3-4b-it"],
  ["mistralai/Mistral-7B-Instruct", "mistralai/mistral-7b-instruct"],
  ["qwen3:4b", "qwen/qwen3-4b"], ["Qwen/Qwen3-4B", "qwen/qwen3-4b"],
  ["unsloth/Llama-3.1-8B-Instruct-GGUF", "meta-llama/llama-3.1-8b-instruct-gguf"],
  ["llama3.1:latest", "meta-llama/llama3.1"], ["deepseek-ai/DeepSeek-V3", "deepseek/deepseek-v3"],
  ["autoversio", "autoversio"], ["SomeOrg/Foo-1B", "someorg/foo-1b"], ["bartowski/foo:latest", "foo"],
];
for (const [i, o] of CASES) if (normaliseModelId(i) !== o) throw new Error(`normaliseModelId selfcheck: ${i} -> ${normaliseModelId(i)}, expected ${o}`);
