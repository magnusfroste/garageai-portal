// Where "Continue with Google" goes. On Lovable Cloud it goes through Lovable's sign-in broker
// (its own Google OAuth client). On a host of our own (deploy/shipholm) there is no broker: the
// auth server does it itself with GarageAI's Google OAuth client. The build decides which:
// VITE_GOOGLE_SIGN_IN=supabase for our own host, anything else (or unset) for Lovable.
export type GoogleSignInMode = "lovable" | "supabase";

export const googleSignInMode = (setting: string | undefined): GoogleSignInMode =>
  setting === "supabase" ? "supabase" : "lovable";

/** What the auth server's GET /auth/v1/settings says about Google (false for anything unexpected). */
export const googleEnabledInSettings = (settings: unknown): boolean => {
  if (typeof settings !== "object" || settings === null || !("external" in settings)) return false;
  const external = (settings as { external: unknown }).external;
  return typeof external === "object" && external !== null && (external as Record<string, unknown>).google === true;
};

export interface GoogleSignInResult { error?: unknown; redirected?: boolean }

export interface GoogleSignInDeps {
  /** Lovable's broker: resolves with `redirected` when the browser leaves for Google. */
  viaLovable: (redirectTo: string) => Promise<GoogleSignInResult>;
  /** The auth server's own OAuth start: the browser leaves for Google unless it returns an error. */
  viaAuthServer: (redirectTo: string) => Promise<{ error: unknown }>;
  /** The auth server's public settings. */
  authSettings: () => Promise<unknown>;
}

export async function startGoogleSignIn(mode: GoogleSignInMode, redirectTo: string, deps: GoogleSignInDeps): Promise<GoogleSignInResult> {
  if (mode === "lovable") return deps.viaLovable(redirectTo);
  // Ask first: with Google switched off the auth server would answer the browser with a bare
  // error page instead of the portal.
  if (!googleEnabledInSettings(await deps.authSettings())) return { error: new Error("Google sign-in is not set up on this server") };
  const { error } = await deps.viaAuthServer(redirectTo);
  return error ? { error } : { redirected: true };
}
