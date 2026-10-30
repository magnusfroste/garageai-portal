import { isSignupIntent, type SignupIntent } from "@/models/types/onboarding.types";

const APP_ORIGIN = "https://app.garageai.eu";

/** Return a same-site path, never a host or a browser-normalised network URL. */
export function safeSignupDestination(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 2048 || /[\\\s\u0000-\u001f\u007f]/.test(value)) return null;
  if (!value.startsWith("/") && !value.startsWith(`${APP_ORIGIN}/`)) return null;
  try {
    const url = new URL(value, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN || url.username || url.password) return null;
    let decoded = url.pathname;
    for (let i = 0; i < 3; i++) {
      decoded = decodeURIComponent(decoded);
      if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return null;
    }
    if (["/auth", "/onboarding"].includes(url.pathname.replace(/\/$/, ""))) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}

export function destinationIntent(destination: string | null, explicit?: unknown): SignupIntent | null {
  const path = destination?.split(/[?#]/)[0];
  if (path === "/bridge/link" || path === "/connect" || path === "/dashboard/connect") return "operator";
  if (path === "/dashboard/keys") return "buyer";
  return isSignupIntent(explicit as string | null) ? explicit as SignupIntent : null;
}

export function signupContinuation(search: string, fallback?: string | null) {
  const params = new URLSearchParams(search);
  const destination = safeSignupDestination(params.has("next") ? params.get("next") : fallback);
  return { destination, intent: destinationIntent(destination, params.get("intent")) };
}

/** Metadata belongs to the account, so this works with no browser storage after confirmation. */
export function firstLoginContinuation(
  profile: { onboarding_done: boolean; signup_intent: SignupIntent | null },
  metadata: Record<string, unknown>,
  requested?: string | null,
  intent?: SignupIntent | null,
) {
  const destination = safeSignupDestination(requested) ?? (!profile.onboarding_done ? safeSignupDestination(metadata.signup_destination) : null);
  const choice = profile.signup_intent ?? destinationIntent(destination, intent ?? metadata.signup_intent);
  return { destination: destination ?? (profile.onboarding_done ? "/dashboard" : "/onboarding"),
    completeOnboarding: !!destination && !profile.onboarding_done, intent: choice };
}