export interface UserBudget {
  budget_pending?: boolean;
  retry_after_ms?: number | null;
  max_budget: number;
  spend: number;
  budget_remaining: number;
  purchased_credits_usd: number;
  litellm_user_id: string | null;
}
