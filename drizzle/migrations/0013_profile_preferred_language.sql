ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_preferred_language_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_preferred_language_check CHECK (preferred_language IN ('en', 'sv'));
  END IF;
END $$;
GRANT UPDATE (full_name, company, signup_intent, onboarding_done, preferred_language) ON public.profiles TO authenticated;