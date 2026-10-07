// Public model names: buyers see the route they called (LiteLLM model group), never upstream ids.

export /**
 * Map an upstream id (litellm_params.model, e.g. "openai/<runtime id>") to the
 * public route a buyer called. Prefers the pool route over garage/ routes.
 * Buyers must never see upstream ids, so unknown ids become "unknown".
 */
async function fetchRouteMap(base: string, masterKey: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await fetch(`${base}/model/info`, { headers: { Authorization: `Bearer ${masterKey}` } });
    if (!res.ok) return map;
    const data = await res.json();
    for (const d of (data.data || []) as Array<{ model_name?: string; litellm_params?: { model?: string } }>) {
      const up = d.litellm_params?.model;
      const name = d.model_name;
      if (!up || !name) continue;
      const cur = map.get(up);
      if (!cur || (cur.startsWith('garage/') && !name.startsWith('garage/'))) map.set(up, name);
    }
  } catch (e) {
    console.warn('model/info failed:', e);
  }
  return map;
}

export function publicModelName(group: unknown, upstream: unknown, routes: Map<string, string>, publicNames: Set<string>): string {
  if (typeof group === 'string' && group) return group;
  if (typeof upstream === 'string' && upstream) {
    if (publicNames.has(upstream)) return upstream;
    const mapped = routes.get(upstream);
    if (mapped) return mapped;
  }
  return 'unknown';
}
