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
/** GGUF quantization tag at the end of an id (after .gguf is removed): -Q4_K_M, -Q8_0, -IQ4_NL, -F16, -BF16, :Q4_K_M. */
const QUANT_RE = /[-_.:]((?:i?q[0-9]+(?:_[a-z0-9]+)*)|bf16|f16|f32)$/i;

/** Splits a runtime id into its model part and quantization tag (uppercase, or null). Strips a `.gguf` file suffix. */
export function splitQuantization(runtimeId: string): { base: string; quantization: string | null; gguf: boolean } {
  let base = runtimeId.trim();
  const gguf = /\.gguf$/i.test(base);
  if (gguf) base = base.slice(0, -5);
  const m = base.match(QUANT_RE);
  if (!m) return { base, quantization: null, gguf };
  return { base: base.slice(0, m.index), quantization: m[1].toUpperCase(), gguf: true };
}

export const modelQuantization = (runtimeId: string) => splitQuantization(runtimeId).quantization;

/** GGUF file names write the family version apart ("gemma-4-12b-it"); Ollama tags join it ("gemma4"). */
const joinFamilyVersion = (name: string) => {
  const fam = FAMILY_CREATORS.find(([p]) => name.startsWith(`${p}-`) && /^[0-9]+(\.[0-9]+)*(-|$)/.test(name.slice(p.length + 1)));
  return fam ? fam[0] + name.slice(fam[0].length + 1) : name;
};

export function normaliseModelId(runtimeId: string): string {
  const { base, gguf } = splitQuantization(runtimeId);
  let s = clean(base.toLowerCase());
  if (gguf && !s.includes("/")) s = joinFamilyVersion(s);
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
  ["Qwen3-4B-Q4_K_M.gguf", "qwen/qwen3-4b"], ["gemma-4-12b-it-Q8_0.gguf", "google/gemma4-12b-it"],
  ["Llama-3.1-8B-Instruct-IQ4_NL.gguf", "meta-llama/llama3.1-8b-instruct"], ["qwen3:4b-q4_K_M", "qwen/qwen3-4b"],
  ["Mistral-7B-Instruct-BF16.gguf", "mistralai/mistral-7b-instruct"], ["Qwen3-4B.gguf", "qwen/qwen3-4b"],
];
for (const [i, o] of CASES) if (normaliseModelId(i) !== o) throw new Error(`normaliseModelId selfcheck: ${i} -> ${normaliseModelId(i)}, expected ${o}`);
