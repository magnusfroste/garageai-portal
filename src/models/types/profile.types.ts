export interface Profile {
  full_name: string | null;
  email: string;
  company: string | null;
  purchased_credits_usd: number;
  signup_intent: "buyer" | "operator" | null;
  onboarding_done: boolean;
  terms_version: string | null;
  terms_accepted_at: string | null;
  terms_notice_dismissed_version?: string | null;
  chat_sync: boolean;
  default_key_at: string | null;
  first_goal?: "look" | "use" | "own_machine" | "share" | null;
}

export interface ProfileUpdateData {
  full_name?: string;
  company?: string;
}

export interface OnboardingUpdateData {
  signup_intent: "buyer" | "operator" | null;
  onboarding_done: boolean;
  first_goal?: "look" | "use" | "own_machine" | "share" | null;
  first_goal_at?: string | null;
  first_goal_asked?: boolean;
}
