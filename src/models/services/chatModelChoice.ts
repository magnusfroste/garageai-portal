// Explicit link → healthy remembered choice → newest awake own machine on first
// visit → Auto → healthy default / pool / any → first. Manual picks may be offline.

export interface ChatModelCandidate {
  id: string;
  status?: string;
  is_default?: boolean;
  garage?: string | null;
  garage_tier?: string | null;
  last_heartbeat_at?: string | null;
}

const healthy = (m?: ChatModelCandidate) => !!m && m.status === "healthy";
const isPool = (m: ChatModelCandidate) => !m.garage || m.garage_tier === "pool";
const isOwn = (m: ChatModelCandidate) => m.garage_tier === "private" && m.id.startsWith("mine/");
const heartbeatTime = (m: ChatModelCandidate) => {
  const time = Date.parse(m.last_heartbeat_at ?? "");
  return Number.isFinite(time) ? time : 0;
};
const newestOwn = (models: ChatModelCandidate[]) => models.filter(isOwn).sort((a, b) => heartbeatTime(b) - heartbeatTime(a));

/** The unavailable own machine displaced by Auto, for the optional UI override. */
export function chatMachineFallback(models: ChatModelCandidate[], requested?: string | null, lastUsed?: string | null): ChatModelCandidate | undefined {
  if (requested && models.some(m => m.id === requested)) return undefined;
  const own = lastUsed ? models.find(m => m.id === lastUsed && isOwn(m)) : newestOwn(models)[0];
  if (!own || healthy(own) || (!lastUsed && newestOwn(models).some(healthy))) return undefined;
  const pick = pickChatModel(models, requested, lastUsed);
  return pick?.garage_tier === "auto" || pick?.id === "garageai/auto" ? own : undefined;
}

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
    (!lastUsed ? newestOwn(models).find(healthy) : undefined) ??
    models.find((m) => m.id === "garageai/auto" || m.garage_tier === "auto") ??
    models.find((m) => m.is_default && healthy(m)) ??
    models.find((m) => healthy(m) && isPool(m)) ??
    models.find(healthy) ??
    models[0]
  );
}
