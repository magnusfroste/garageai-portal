import { describe, expect, test, afterAll } from "bun:test";
import { createServer, type Server } from "node:http";
import { runAcceptanceTest } from "../../supabase/functions/_shared/acceptanceTest.ts";

// A retest that fails because the gateway itself is down must be inconclusive,
// never a failed test: connection errors and 502/503/504 from the gateway.

let server: Server | null = null;
let base = "";

function withServer(handler: (code: number) => void) {
  return new Promise<string>((resolve) => {
    server = createServer((req, res) => {
      const code = Number(new URL(req.url!, "http://x").searchParams.get("code") || 500);
      handler(code);
      res.writeHead(code, { "Content-Type": "text/plain" });
      res.end(`error ${code}`);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server!.address();
      base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
      resolve(base);
    });
  });
}

afterAll(() => server?.close());

describe("runAcceptanceTest gateway-down handling", () => {
  test.each([502, 503, 504])("HTTP %i from the gateway is inconclusive, not a failure", async (code) => {
    const url = await withServer(() => {});
    const r = await runAcceptanceTest(url, "key", "g", "m");
    expect(r.passed).toBe(false);
    expect(r.http_status).toBe(code);
    expect(r.inconclusive).toBe(true);
  });

  test("HTTP 500 (a real runtime error) stays a failure", async () => {
    const url = await withServer(() => {});
    const r = await runAcceptanceTest(url, "key", "m", "m");
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
