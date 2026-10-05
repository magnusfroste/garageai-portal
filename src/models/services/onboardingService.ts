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

  private getStoredIntent(): SignupIntent | null {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isSignupIntent(value) ? value : null;
  }

  async routeAfterLogin(user: User): Promise<string> {
    const profile = await profileService.getProfile(user.id);
    const metadataIntent = user.user_metadata?.signup_intent;
    const intent = this.getStoredIntent()
      ?? (isSignupIntent(profile?.signup_intent) ? profile.signup_intent : null)
      ?? (isSignupIntent(metadataIntent) ? metadataIntent : null);

    if (intent) {
      await profileService.completeOnboarding(intent);
      this.clearStoredIntent();
      return intent === "operator" ? "/dashboard/offer-gpu" : "/dashboard";
    }

    return profile?.onboarding_done ? "/dashboard" : "/onboarding";
  }
}

export const onboardingService = new OnboardingService();