import { describe, expect, test, afterAll } from "bun:test";
import { createServer, type Server } from "node:http";
import { runAcceptanceTest } from "../../supabase/functions/_shared/acceptanceTest.ts";

// A retest that fails because the gateway itself is down must be inconclusive,
// never a failed test: connection errors and 502/503/504 from the gateway.

let server: Server | null = null;
let statusCode = 500;

const base = await new Promise<string>((resolve) => {
  server = createServer((_req, res) => {
    res.writeHead(statusCode, { "Content-Type": "text/plain" });
    res.end(`error ${statusCode}`);
  });
  server.listen(0, "127.0.0.1", () => {
    const addr = server!.address();
    resolve(`http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`);
  });
});

afterAll(() => server?.close());

describe("runAcceptanceTest gateway-down handling", () => {
  test.each([502, 503, 504])("HTTP %i from the gateway is inconclusive, not a failure", async (code) => {
    statusCode = code;
    const r = await runAcceptanceTest(base, "key", "g", "m");
    expect(r.passed).toBe(false);
    expect(r.http_status).toBe(code);
    expect(r.inconclusive).toBe(true);
  });

  test("HTTP 500 (a real runtime error) stays a failure", async () => {
    statusCode = 500;
    const r = await runAcceptanceTest(base, "key", "m", "m");
    expect(r.passed).toBe(false);
    expect(r.http_status).toBe(500);
    expect(r.inconclusive).toBeFalsy();
  });

  test("connection refused (gateway unreachable) is inconclusive", async () => {
    // Port 1 is never listening.
    const r = await runAcceptanceTest("http://127.0.0.1:1", "key", "g", "m");
    expect(r.passed).toBe(false);
    expect(r.inconclusive).toBe(true);
  });
});
