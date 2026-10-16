import type { User } from "@supabase/supabase-js";
import { profileService } from "@/models/services/profileService";
import { isSignupIntent, type SignupIntent } from "@/models/types/onboarding.types";

const STORAGE_KEY = "garageai_signup_intent";

class OnboardingService {
  readUrlIntent(search: string): SignupIntent | null {
    const value = new URLSearchParams(search).get("intent");
    return isSignupIntent(value) ? value : null;
  }

  storeIntent(intent: SignupIntent): void {
    window.localStorage.setItem(STORAGE_KEY, intent);
  }

  clearStoredIntent(): void {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  async routeAfterLogin(user: User): Promise<string> {
    const profile = await profileService.getProfile(user.id);
    if (!profile?.onboarding_done) return "/onboarding";
    this.clearStoredIntent();
    return "/dashboard";
  }
}

export const onboardingService = new OnboardingService();