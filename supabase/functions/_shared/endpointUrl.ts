// SSRF boundary for provider endpoints: the gateway sits inside a private mesh.

const v4ToInt = (ip: string) => ip.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
const inV4 = (ip: string, cidr: string) => {
  const [base, bits] = cidr.split("/");
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (v4ToInt(ip) & mask) === (v4ToInt(base) & mask);
};
const BLOCKED_V4 = ["0.0.0.0/8", "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16", "100.64.0.0/10", "192.0.0.0/24", "198.18.0.0/15", "224.0.0.0/4", "240.0.0.0/4"];
const V4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

export function isBlockedIp(ip: string): boolean {
  const a = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (V4_RE.test(a)) return BLOCKED_V4.some((c) => inV4(a, c));
  if (!a.includes(":")) return true;
  const mapped = a.match(/^::ffff:(\d{1,3}(\.\d{1,3}){3})$/);
  if (mapped) return isBlockedIp(mapped[1]);
  if (a === "::" || a === "::1") return true;
  const first = parseInt(a.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (a.startsWith("::ffff:") || a.startsWith("64:ff9b:")) return true; // mapped/NAT64 forms
  return false;
}

/** Returns the normalised URL ending in /v1, or throws with a user-facing message. */
export async function validateEndpointUrl(raw: unknown, opts: { allowPort?: boolean; blockedHosts?: string[] } = {}): Promise<string> {
  if (typeof raw !== "string" || raw.length > 300) throw new Error("endpoint_url must be a URL string");
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new Error("endpoint_url is not a valid URL"); }
  if (u.protocol !== "https:") throw new Error("endpoint_url must use https://");
  if (u.username || u.password) throw new Error("endpoint_url must not contain credentials");
  if (u.port && u.port !== "443" && !opts.allowPort) throw new Error("endpoint_url must use port 443 (pass allow_port to override)");
  if (u.search || u.hash) throw new Error("endpoint_url must not contain a query or fragment");
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") && !host.includes(":"))
    throw new Error("endpoint_url host is not a public hostname");
  if ((opts.blockedHosts || []).includes(host)) throw new Error("endpoint_url must not point at this gateway");
  if (V4_RE.test(host) || host.includes(":")) {
    if (isBlockedIp(host)) throw new Error("endpoint_url points to a private or reserved address");
  } else {
    const addrs: string[] = [];
    for (const type of ["A", "AAAA"] as const) {
      try { addrs.push(...await Deno.resolveDns(host, type)); } catch { /* no records of this type */ }
    }
    if (!addrs.length) throw new Error("endpoint_url host does not resolve");
    if (addrs.some(isBlockedIp)) throw new Error("endpoint_url resolves to a private or reserved address");
  }
  let path = u.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/v1")) path += "/v1";
  return `https://${u.host}${path}`;
}

// Unit-style self-check (runs once at import, cheap).
for (const [ip, blocked] of [["10.1.2.3", true], ["172.20.0.1", true], ["192.168.1.5", true], ["100.83.1.1", true], ["169.254.1.1", true], ["127.0.0.1", true], ["8.8.8.8", false], ["::1", true], ["fd00::1", true], ["fe80::1", true], ["2606:4700::1111", false]] as const) {
  if (isBlockedIp(ip) !== blocked) console.error(`[endpointUrl] self-check failed for ${ip}`);
}
