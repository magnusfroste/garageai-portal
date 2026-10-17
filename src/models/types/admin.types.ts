export interface AdminUser {
  id: string;
  full_name: string | null;
  email: string;
  company: string | null;
  litellm_user_id: string | null;
  litellm_budget: {
    max_budget: number;
    spend: number;
  } | null;
  created_at: string;
  terms_version: string | null;
}

export interface UpdateUserPayload {
  user_id: string;
  litellm_max_budget?: number;
}
