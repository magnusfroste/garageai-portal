export const BUDGET_RETRY_MS = 3000;

export function resolveUserBudget(profile: { starting_credit_usd?: number | null; purchased_credits_usd?: number | null; litellm_user_id?: string | null }, info?: Record<string, unknown> | null) {
  const configured = Number(profile.starting_credit_usd ?? 0) + Number(profile.purchased_credits_usd ?? 0);
  const pending = !info || info.max_budget == null;
  const maxBudget = pending ? configured : Number(info.max_budget);
  const spend = Number(info?.spend ?? 0);
  return { max_budget: maxBudget, spend, budget_remaining: maxBudget - spend,
    purchased_credits_usd: profile.purchased_credits_usd ?? 0,
    litellm_user_id: profile.litellm_user_id ?? null, budget_pending: pending };
}