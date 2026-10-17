import { useState, useEffect } from "react";
import { profileService } from "@/models/services/profileService";
import { Profile } from "@/models/types/profile.types";

export const useProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchProfile();
    window.addEventListener("account-terms-accepted", fetchProfile);
    return () => window.removeEventListener("account-terms-accepted", fetchProfile);
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await profileService.getCurrentUserProfile();
      setProfile(data);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { profile, loading, error, refetch: fetchProfile };
};
