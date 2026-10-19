/** The single policy for both new keys and the existing-key backfill. */
export const PORTAL_KEY_LIMITS = {
  user: { max_parallel_requests: 10, rpm_limit: 120 },
  chat: { max_parallel_requests: 4, rpm_limit: 60 },
} as const;

export const keyLimits = (kind: string | null | undefined) =>
  kind === "chat" ? PORTAL_KEY_LIMITS.chat : PORTAL_KEY_LIMITS.user;