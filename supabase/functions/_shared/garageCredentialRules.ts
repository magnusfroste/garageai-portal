// Pure rules behind garage credential issuing (create-garage and bridge-link-approve).
export const MAX_GARAGES_PER_OPERATOR = 5;
export const MAX_TOKENS_PER_DAY = 20;
/** Stable error codes; the portal turns them into plain words with a support link. */
export const GARAGE_LIMIT_ERROR = "garage_limit";
export const TOKEN_LIMIT_ERROR = "too_many_connects";

/** Same decision create-garage has always made: admins choose; operators get a key unless they opt out and already have a peer. */
export function decideSetupKey(requested: unknown, isAdmin: boolean, hasPeer: boolean): boolean {
  let create = requested === undefined ? true : requested === true;
  if (!isAdmin && !(requested === false && hasPeer)) create = true;
  return create;
}

export interface ExistingGarage { operator_id: string | null; disabled?: boolean | null; machine_id?: string | null }

/** Re-approving the same garage from the machine it is already linked to. Such tokens never count toward the daily limit. */
export function isSameMachineRelink(existing: ExistingGarage | null, machineId: string | null | undefined): boolean {
  return !!existing?.machine_id && !!machineId && existing.machine_id === machineId;
}

/** True when a non-admin operator cannot add another garage. */
export const garageLimitReached = (ownedCount: number, isAdmin: boolean) => !isAdmin && ownedCount >= MAX_GARAGES_PER_OPERATOR;

/** Ownership checks for non-admin callers; null means allowed. tokensLastDay counts only non-relink tokens. */
export function ownershipError(existing: ExistingGarage | null, userId: string, isAdmin: boolean, ownedCount: number, tokensLastDay: number, relink = false): { status: number; error: string } | null {
  if (isAdmin) return null;
  if (existing && existing.operator_id !== userId) return { status: 409, error: "name taken" };
  if (existing?.disabled) return { status: 403, error: "garage disabled by platform" };
  if (!existing && garageLimitReached(ownedCount, false)) return { status: 409, error: GARAGE_LIMIT_ERROR };
  if (!relink && tokensLastDay >= MAX_TOKENS_PER_DAY) return { status: 429, error: TOKEN_LIMIT_ERROR };
  return null;
}
