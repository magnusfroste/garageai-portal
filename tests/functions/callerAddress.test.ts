import { expect, test } from "bun:test";
import { callerAddress, GATEWAY_PROXY_IPS } from "../../supabase/functions/_shared/callerAddress";

const request = (headers: Record<string, string>) => new Request("https://example.test", { headers });

test("direct callers retain their connecting address even with a client header", () => {
  expect(callerAddress(request({ "x-forwarded-for": "198.51.100.8, 37.27.221.1", "x-real-ip": "192.0.2.9", "x-garageai-client-ip": "203.0.113.7" })))
    .toEqual({ address: "198.51.100.8", fromHeader: false });
  expect(callerAddress(request({ "x-forwarded-for": "198.51.100.8" })))
    .toEqual({ address: "198.51.100.8", fromHeader: false });
});

test("connecting address falls back to real IP then unknown without trusting the client header", () => {
  expect(callerAddress(request({ "x-real-ip": "192.0.2.9", "x-garageai-client-ip": "203.0.113.7" })))
    .toEqual({ address: "192.0.2.9", fromHeader: false });
  expect(callerAddress(request({ "x-garageai-client-ip": "203.0.113.7" })))
    .toEqual({ address: "unknown", fromHeader: false });
});

test("gateway callers use the valid trimmed first client address", () => {
  expect(GATEWAY_PROXY_IPS).toEqual(["37.27.221.1"]);
  expect(callerAddress(request({ "x-forwarded-for": "37.27.221.1, 192.0.2.9", "x-garageai-client-ip": " 203.0.113.7 , 198.51.100.8" })))
    .toEqual({ address: "203.0.113.7", fromHeader: true });
  expect(callerAddress(request({ "x-real-ip": "37.27.221.1", "x-garageai-client-ip": "203.0.113.7" })))
    .toEqual({ address: "203.0.113.7", fromHeader: true });
});

test("gateway callers with missing empty or malformed client addresses retain the gateway address", () => {
  for (const value of [undefined, "", " ", "invalid", "256.1.2.3", "1.2.3", "1.2.3.4:80", "[2001:db8::1]", "2001:db8:::1", ", 203.0.113.7"]) {
    const headers: Record<string, string> = { "x-forwarded-for": "37.27.221.1" };
    if (value !== undefined) headers["x-garageai-client-ip"] = value;
    expect(callerAddress(request(headers))).toEqual({ address: "37.27.221.1", fromHeader: false });
  }
});

test("gateway client IPv6 addresses are accepted", () => {
  for (const address of ["2001:db8::1", "::1", "::ffff:192.0.2.1", "2001:db8:0:0:0:0:0:1"]) {
    expect(callerAddress(request({ "x-forwarded-for": "37.27.221.1", "x-garageai-client-ip": address })))
      .toEqual({ address, fromHeader: true });
  }
});