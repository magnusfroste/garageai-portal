// GarageAI's own hosts. A provider endpoint must never point back at our gateway:
// that would make the gateway call itself and loop. Kept in one place so every
// edge function that accepts an endpoint URL blocks exactly the same set.
//
// Any host under garageai.eu counts, so new gateway hostnames (api.garageai.eu,
// llm.garageai.eu, app.garageai.eu, ...) are covered without editing this file.

/** Domains whose whole subtree is ours. */
export const GARAGE_DOMAINS = ["garageai.eu"] as const;

/** Individual hosts that are ours but live under another domain. */
export const GARAGE_EXTRA_HOSTS = ["portal.liteit.se"] as const;

/** True for a host that belongs to GarageAI itself (exact domain or any subdomain). */
export function isGarageHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if ((GARAGE_EXTRA_HOSTS as readonly string[]).includes(h)) return true;
  return (GARAGE_DOMAINS as readonly string[]).some((d) => h === d || h.endsWith(`.${d}`));
}
