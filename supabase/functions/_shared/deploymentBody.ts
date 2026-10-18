// Pure: the exact /model/new body for a garage deployment (no runtime imports, so tests can load it).
/** Placeholder sent to runtimes without auth (e.g. Ollama); the openai provider needs some key. */
export const NO_KEY = "garage-node";
export interface DeploymentBodySpec {
  id: string; route: string; model: string; apiBase: string; apiKey: string | null; keyFp: string; input: number; output: number; cacheRead: number; tier: string;
  limits?: { maxInput: number; maxOutput: number } | null; order?: number; weight?: number;
  garage: { name: string; operator_id: string | null; runtime: string | null; connection_type?: string | null };
}

/** Auto order must be present in routing params as well as the existing metadata. */
export const deploymentOrderMatches = (order: number | undefined, params?: { order?: number | null }, info?: { order?: number | null }) =>
  order == null || (params?.order === order && info?.order === order);

/** Exactly what /model/new receives; pool deployments carry the simple-shuffle `weight`. */
export function deploymentBody(s: DeploymentBodySpec) {
  return {
      model_name: s.route,
      litellm_params: { model: `openai/${s.model}`, api_base: s.apiBase, api_key: s.apiKey || NO_KEY, input_cost_per_token: s.input / 1e6, output_cost_per_token: s.output / 1e6, cache_read_input_token_cost: s.cacheRead / 1e6,
        ...(s.tier === "pool" && s.weight != null ? { weight: s.weight } : {}),
        ...(s.order != null ? { order: s.order } : {}) },
      model_info: { id: s.id, mode: "chat", garage: s.garage.name, operator_id: s.garage.operator_id, runtime: s.garage.runtime, garage_tier: s.tier, connection_type: s.garage.connection_type || "mesh", key_fingerprint: s.keyFp, cache_read_input_token_cost: s.cacheRead / 1e6,
        ...(s.order != null ? { order: s.order } : {}),
        ...(s.limits ? { max_input_tokens: s.limits.maxInput, max_output_tokens: s.limits.maxOutput, max_tokens: s.limits.maxInput } : {}) },
  };
}

