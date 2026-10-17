export interface Profile {
  full_name: string | null;
  email: string;
  company: string | null;
  purchased_credits_usd: number;
  signup_intent: "buyer" | "operator" | null;
  onboarding_done: boolean;
  preferred_language: "en" | "sv";
  terms_version: string | null;
  terms_accepted_at: string | null;
}

export interface ProfileUpdateData {
  full_name?: string;
  company?: string;
}

export interface OnboardingUpdateData {
  signup_intent: "buyer" | "operator" | null;
  onboarding_done: boolean;
}
