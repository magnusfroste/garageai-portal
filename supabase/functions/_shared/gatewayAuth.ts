// Auth for the gateway VPS health service: header x-gateway-key must equal LITELLM_MASTER_KEY (constant-time compare).
export const gatewayJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function isGatewayAuthorized(req: Request): Promise<boolean> {
  const expected = Deno.env.get("LITELLM_MASTER_KEY");
  const given = req.headers.get("x-gateway-key");
  if (!expected || !given) return false;
  // Hash both sides so lengths match, then compare every byte.
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(expected)), crypto.subtle.digest("SHA-256", enc.encode(given))]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
