import { profileRepository } from "@/data/repositories/profileRepository";
import { authService } from "./authService";
import { Profile, ProfileUpdateData } from "@/models/types/profile.types";
import type { SignupIntent } from "@/models/types/onboarding.types";

export class ProfileService {
  async getCurrentUserProfile(): Promise<Profile | null> {
    const user = await authService.getCurrentUser();
    if (!user) return null;

    return profileRepository.findById(user.id);
  }

  async getProfile(userId: string): Promise<Profile | null> {
    return profileRepository.findById(userId);
  }

  async updateProfile(updates: ProfileUpdateData): Promise<void> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error("Not authenticated");
    return profileRepository.update(user.id, updates);
  }

  async completeOnboarding(intent: SignupIntent | null): Promise<void> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error("Not authenticated");
    return profileRepository.updateOnboarding(user.id, { signup_intent: intent, onboarding_done: true });
  }
}

export const profileService = new ProfileService();
