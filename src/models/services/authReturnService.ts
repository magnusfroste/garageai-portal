import { signupContinuation } from "./signupDestination";

// Temporary sign-in state only; signup also stores the destination with the account.
const KEY = "garageai_auth_next";

export const authReturnService = {
  remember(search: string) {
    const params = new URLSearchParams(search);
    if (!params.has("next")) return;
    const next = signupContinuation(search).destination;
    if (next) window.sessionStorage.setItem(KEY, next);
    else window.sessionStorage.removeItem(KEY);
  },
  peek(search: string) {
    return signupContinuation(search, window.sessionStorage.getItem(KEY)).destination;
  },
  /** `?next=…` for the confirmation link, so a new tab also returns to the same page. */
  query(search: string) {
    const continuation = signupContinuation(search, window.sessionStorage.getItem(KEY));
    const params = new URLSearchParams();
    if (continuation.destination) params.set("next", continuation.destination);
    if (continuation.intent) params.set("intent", continuation.intent);
    return params.size ? `?${params.toString()}` : "";
  },
  take(search: string): string | null {
    const next = this.peek(search);
    window.sessionStorage.removeItem(KEY);
    window.localStorage.removeItem(KEY); // discard obsolete, device-wide return state
    return next;
  },
};
