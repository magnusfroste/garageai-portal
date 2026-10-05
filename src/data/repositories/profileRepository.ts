import { supabase } from "@/integrations/supabase/client";
import { OnboardingUpdateData, Profile } from "@/models/types/profile.types";

export class ProfileRepository {
  async findById(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, email, company, purchased_credits_usd, signup_intent, onboarding_done")
      .eq("id", userId)
      .single();

    if (error) throw error;
    return data;
  }

  async update(userId: string, updates: { full_name?: string; company?: string }): Promise<void> {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) throw error;
  }

  async updateOnboarding(userId: string, updates: OnboardingUpdateData): Promise<void> {
    const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
    if (error) throw error;
  }
}

export const profileRepository = new ProfileRepository();
