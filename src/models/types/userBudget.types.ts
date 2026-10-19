export interface UserBudget {
  budget_pending?: boolean;
  max_budget: number;
  spend: number;
  budget_remaining: number;
  purchased_credits_usd: number;
  litellm_user_id: string | null;
}
