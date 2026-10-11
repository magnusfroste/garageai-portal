// Keeps "come back to this page" across sign-in, sign-up, e-mail confirmation and Google redirects.
const KEY = "garageai_auth_next";
const safe = (v: string | null | undefined) => (v && v.startsWith("/") && !v.startsWith("//") ? v : null);

export const authReturnService = {
  remember(search: string) {
    const next = safe(new URLSearchParams(search).get("next"));
    if (next) window.localStorage.setItem(KEY, next);
  },
  /** `?next=…` for the confirmation link, so a new tab also returns to the same page. */
  query(search: string) {
    const next = safe(new URLSearchParams(search).get("next")) ?? safe(window.localStorage.getItem(KEY));
    return next ? `?next=${encodeURIComponent(next)}` : "";
  },
  take(search: string): string | null {
    const next = safe(new URLSearchParams(search).get("next")) ?? safe(window.localStorage.getItem(KEY));
    window.localStorage.removeItem(KEY);
    return next;
  },
};
