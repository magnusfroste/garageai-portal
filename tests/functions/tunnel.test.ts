import { expect, test } from "bun:test";
import { lowestFreeTunnelIp, validTunnelKey, resolveGaragePeer, transportTargetFields, tunnelStatus } from "../../supabase/functions/_shared/tunnel";

const KEY = "y2tVj41DZ7Db+C6djttop0A4Z3I0NbpnZ70Y1AJ1/R0=";

test("tunnel-assign: first address is 10.66.0.2 and the lowest free one is reused", () => {
  expect(lowestFreeTunnelIp([])).toBe("10.66.0.2");
  expect(lowestFreeTunnelIp(["10.66.0.2", "10.66.0.4"])).toBe("10.66.0.3");
});

test("tunnel-assign: never hands out .0, .1 or .255", () => {
  const used = Array.from({ length: 253 }, (_, i) => `10.66.0.${i + 2}`); // .2–.254
  expect(lowestFreeTunnelIp(used)).toBe("10.66.1.2");
});

test("tunnel-assign: rejects bad keys, accepts a 32-byte base64 key", () => {
  expect(validTunnelKey(KEY)).toBe(true);
  expect(validTunnelKey("not-a-key")).toBe(false);
  expect(validTunnelKey(btoa("x".repeat(31)) )).toBe(false);
  expect(validTunnelKey(42)).toBe(false);
});

test("register-node for a tunnel garage skips NetBird and uses tunnel_ip", async () => {
  let called = false;
  const peer = await resolveGaragePeer({ transport: "tunnel", tunnel_ip: "10.66.0.7" }, async () => { called = true; return { id: "nb", ip: "100.64.0.1" }; });
  expect(peer).toEqual({ id: null, ip: "10.66.0.7" });
  expect(called).toBe(false);
  const nb = await resolveGaragePeer({ transport: "netbird" }, async () => ({ id: "nb", ip: "100.64.0.1" }));
  expect(nb.id).toBe("nb");
});

test("gateway-targets carries the tunnel fields", () => {
  expect(transportTargetFields({ transport: "tunnel", tunnel_ip: "10.66.0.7", tunnel_public_key: KEY })).toEqual({ transport: "tunnel", tunnel_ip: "10.66.0.7", tunnel_public_key: KEY });
  expect(transportTargetFields({})).toEqual({ transport: "netbird", tunnel_ip: null, tunnel_public_key: null });
});

test("a tunnel garage is never offline because NetBird lacks it", () => {
  expect(tunnelStatus({})).toBe("unknown");
  expect(tunnelStatus({ last_gateway_check_at: new Date().toISOString(), runtime_ok: true, mesh_connected: true })).toBe("healthy");
  expect(tunnelStatus({ last_gateway_check_at: new Date().toISOString(), runtime_ok: true, mesh_connected: false })).toBe("unhealthy");
});
