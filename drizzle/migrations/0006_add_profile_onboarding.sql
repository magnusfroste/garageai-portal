ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_intent text,
  ADD COLUMN IF NOT EXISTS onboarding_done boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_signup_intent_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_signup_intent_check
      CHECK (signup_intent IS NULL OR signup_intent IN ('buyer', 'operator'));
  END IF;
END
$$;

REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;
GRANT UPDATE (full_name, company, signup_intent, onboarding_done) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count int;
  requested_intent text;
BEGIN
  requested_intent := NEW.raw_user_meta_data->>'signup_intent';
  IF requested_intent NOT IN ('buyer', 'operator') THEN
    requested_intent := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, signup_intent)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    requested_intent
  );

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;