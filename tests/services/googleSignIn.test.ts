import { expect, test } from "bun:test";
import { googleEnabledInSettings, googleSignInMode, startGoogleSignIn, type GoogleSignInDeps } from "../../src/models/services/googleSignInService";

const calls: string[] = [];
const deps = (patch: Partial<GoogleSignInDeps> = {}): GoogleSignInDeps => ({
  viaLovable: async (to) => { calls.push(`lovable ${to}`); return { redirected: true }; },
  viaAuthServer: async (to) => { calls.push(`auth ${to}`); return { error: null }; },
  authSettings: async () => ({ external: { google: true, email: true } }),
  ...patch,
});

test("only the exact setting chooses our own auth server; Lovable stays the default", () => {
  expect(googleSignInMode("supabase")).toBe("supabase");
  for (const other of [undefined, "", "lovable", "Supabase", "true"]) expect(googleSignInMode(other)).toBe("lovable");
});

test("Google counts as on only when the auth server says exactly that", () => {
  expect(googleEnabledInSettings({ external: { google: true } })).toBe(true);
  for (const off of [null, undefined, "x", {}, { external: null }, { external: {} }, { external: { google: false } }, { external: { google: "true" } }]) {
    expect(googleEnabledInSettings(off)).toBe(false);
  }
});

test("on Lovable the broker is used and the auth server is not asked", async () => {
  calls.length = 0;
  const result = await startGoogleSignIn("lovable", "https://app.example/auth?x=1", deps({ authSettings: async () => { throw new Error("must not be called"); } }));
  expect(result).toEqual({ redirected: true });
  expect(calls).toEqual(["lovable https://app.example/auth?x=1"]);
});

test("on our own host the auth server starts it, with the same return address", async () => {
  calls.length = 0;
  expect(await startGoogleSignIn("supabase", "https://app.example/auth?x=1", deps())).toEqual({ redirected: true });
  expect(calls).toEqual(["auth https://app.example/auth?x=1"]);
});

test("on our own host with Google off nothing is started and the page gets an error", async () => {
  calls.length = 0;
  const result = await startGoogleSignIn("supabase", "https://app.example/auth", deps({ authSettings: async () => ({ external: { google: false } }) }));
  expect(result.error).toBeInstanceOf(Error);
  expect(result.redirected).toBeUndefined();
  expect(calls).toEqual([]);
});

test("an error from the auth server is passed on, not reported as a redirect", async () => {
  const failure = new Error("provider is not enabled");
  expect(await startGoogleSignIn("supabase", "https://app.example/auth", deps({ viaAuthServer: async () => ({ error: failure }) }))).toEqual({ error: failure });
});
