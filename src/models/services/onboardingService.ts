import type { User } from "@supabase/supabase-js";
import { profileService } from "@/models/services/profileService";
import { isSignupIntent, type SignupIntent } from "@/models/types/onboarding.types";
import { firstLoginContinuation } from "./signupDestination";
import { profileRepository } from "@/data/repositories/profileRepository";

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

  async routeAfterLogin(user: User, requested?: string | null, intent?: SignupIntent | null): Promise<string> {
    const profile = await profileService.getProfile(user.id);
    if (!profile) throw new Error("Account profile is not available yet");
    const continuation = firstLoginContinuation(profile, user.user_metadata, requested, intent);
    if (continuation.completeOnboarding) {
      await profileRepository.updateOnboarding(user.id, { signup_intent: continuation.intent, onboarding_done: true });
    }
    this.clearStoredIntent();
    return continuation.destination;
  }
}

export const onboardingService = new OnboardingService();