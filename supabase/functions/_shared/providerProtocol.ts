// Provider protocol is derived from the trusted endpoint, never a model-name guess.
export function providerUpstream(model: string, apiBase: string, connectionType?: string | null) {
  let anthropic = false;
  try { anthropic = connectionType === "endpoint" && new URL(apiBase).hostname.toLowerCase() === "api.anthropic.com"; } catch { /* invalid URLs are rejected at creation */ }
  if (anthropic) {
    return { model: `anthropic/${model.replace(/^anthropic\//i, "")}`, api_base: apiBase.replace(/\/$/, "").replace(/\/v1$/, "") };
  }
  return { model: `openai/${model}`, api_base: apiBase };
}