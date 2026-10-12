// Public buyer API hosts block admin routes by design; never use them for internal calls.
const PUBLIC_GATEWAY_HOSTS = new Set(["api.garageai.eu"]);
export function isPublicGatewayHost(url: string): boolean {
  try { return PUBLIC_GATEWAY_HOSTS.has(new URL(url).hostname.toLowerCase()); } catch { return false; }
}
