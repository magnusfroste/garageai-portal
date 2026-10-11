// Pure rules behind garage credential issuing (create-garage and bridge-link-approve).
export const MAX_GARAGES_PER_OPERATOR = 5;
export const MAX_TOKENS_PER_DAY = 10;

/** Same decision create-garage has always made: admins choose; operators get a key unless they opt out and already have a peer. */
export function decideSetupKey(requested: unknown, isAdmin: boolean, hasPeer: boolean): boolean {
  let create = requested === undefined ? true : requested === true;
  if (!isAdmin && !(requested === false && hasPeer)) create = true;
  return create;
}

export interface ExistingGarage { operator_id: string | null; disabled?: boolean | null }

/** Ownership checks for non-admin callers; null means allowed. */
export function ownershipError(existing: ExistingGarage | null, userId: string, isAdmin: boolean, ownedCount: number, tokensLastDay: number): { status: number; error: string } | null {
  if (isAdmin) return null;
  if (existing && existing.operator_id !== userId) return { status: 409, error: "name taken" };
  if (existing?.disabled) return { status: 403, error: "garage disabled by platform" };
  if (!existing && ownedCount >= MAX_GARAGES_PER_OPERATOR) return { status: 409, error: "You can have at most 5 garages" };
  if (tokensLastDay >= MAX_TOKENS_PER_DAY) return { status: 429, error: "Too many requests: max 10 per 24 hours" };
  return null;
}
