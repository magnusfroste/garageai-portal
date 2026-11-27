import { supabase } from "@/integrations/supabase/client";
import { googleSignInMode, startGoogleSignIn, type GoogleSignInResult } from "@/models/services/googleSignInService";

const MODE = googleSignInMode(import.meta.env.VITE_GOOGLE_SIGN_IN);

/** Starts "Continue with Google" the way this build's host does it (googleSignInService). */
export const signInWithGoogle = (redirectTo: string): Promise<GoogleSignInResult> =>
  startGoogleSignIn(MODE, redirectTo, {
    // Loaded only where it is used: a build for our own host never fetches Lovable's broker.
    viaLovable: async (to) => (await import("@/integrations/lovable/index")).lovable.auth.signInWithOAuth("google", { redirect_uri: to }),
    viaAuthServer: (to) => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: to } }),
    authSettings: async () => {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      return response.ok ? response.json() : null;
    },
  });
