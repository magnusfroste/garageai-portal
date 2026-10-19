// Internal LiteLLM key alias: unique across all users, never shown to buyers.
export function slugKeyName(name: string): string {
  const s = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return s || "key";
}

export function randomSuffix(n = 4): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function litellmKeyAlias(userId: string, name: string, suffix = randomSuffix()): string {
  return `${userId.slice(0, 8)}-${slugKeyName(name)}-${suffix}`;
}
