import { supabase } from "@/integrations/supabase/client";
import { OnboardingUpdateData, Profile } from "@/models/types/profile.types";

export class ProfileRepository {
  async findById(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, email, company, purchased_credits_usd, signup_intent, onboarding_done, preferred_language")
      .eq("id", userId)
      .single();

    if (error) throw error;
    return data as Profile;
  }

  async update(userId: string, updates: { full_name?: string; company?: string }): Promise<void> {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) throw error;
  }

  async updateLanguage(userId: string, preferred_language: "en" | "sv"): Promise<void> {
    const { error } = await supabase.from("profiles").update({ preferred_language }).eq("id", userId);
    if (error) throw error;
  }

  async updateOnboarding(userId: string, updates: OnboardingUpdateData): Promise<void> {
    const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
    if (error) throw error;
  }
}

export const profileRepository = new ProfileRepository();
