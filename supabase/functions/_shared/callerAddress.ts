import { isIP } from "node:net";

export const GATEWAY_PROXY_IPS: readonly string[] = ["37.27.221.1"];

/** Trust the proxy's caller header only when the connecting address is a gateway. */
export function callerAddress(req: Request): { address: string; fromHeader: boolean } {
  const address = (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
  if (GATEWAY_PROXY_IPS.includes(address)) {
    const forwarded = req.headers.get("x-garageai-client-ip")?.split(",")[0]?.trim();
    if (forwarded && isIP(forwarded) !== 0) {
      return { address: forwarded, fromHeader: true };
    }
  }
  return { address, fromHeader: false };
}