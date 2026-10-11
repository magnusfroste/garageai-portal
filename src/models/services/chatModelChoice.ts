// Picks the chat model: explicit ?model= wins (even if unhealthy), then
// last used / default only when healthy, then the first healthy pool model,
// then any healthy model, then the first model.

export interface ChatModelCandidate {
  id: string;
  status?: string;
  is_default?: boolean;
  garage?: string | null;
  garage_tier?: string | null;
}

const healthy = (m?: ChatModelCandidate) => !!m && m.status === "healthy";
const isPool = (m: ChatModelCandidate) => !m.garage || m.garage_tier === "pool";

export function pickChatModel(
  models: ChatModelCandidate[],
  requested?: string | null,
  lastUsed?: string | null,
): ChatModelCandidate | undefined {
  if (!models.length) return undefined;
  const find = (id?: string | null) => (id ? models.find((m) => m.id === id) : undefined);
  const last = find(lastUsed);
  return (
    find(requested) ??
    (healthy(last) ? last : undefined) ??
    models.find((m) => m.is_default && healthy(m)) ??
    models.find((m) => healthy(m) && isPool(m)) ??
    models.find(healthy) ??
    models[0]
  );
}
