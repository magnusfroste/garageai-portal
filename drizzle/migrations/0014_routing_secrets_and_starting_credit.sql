CREATE TABLE IF NOT EXISTS public.garage_runtime_secrets (
  garage_id uuid PRIMARY KEY REFERENCES public.garages(id) ON DELETE CASCADE,
  runtime_api_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.garage_runtime_secrets TO service_role;
REVOKE ALL ON public.garage_runtime_secrets FROM anon, authenticated;
ALTER TABLE public.garage_runtime_secrets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS starting_credit_usd numeric NOT NULL DEFAULT 0;
UPDATE public.profiles SET starting_credit_usd = coalesce(
  (SELECT nullif(value #>> '{}', '')::numeric FROM public.admin_settings WHERE key = 'default_user_budget_usd'), 25)
WHERE starting_credit_usd = 0;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  user_count int;
  requested_intent text;
  starting numeric;
BEGIN
  requested_intent := NEW.raw_user_meta_data->>'signup_intent';
  IF requested_intent NOT IN ('buyer', 'operator') THEN requested_intent := NULL; END IF;
  SELECT coalesce((SELECT nullif(value #>> '{}', '')::numeric FROM public.admin_settings WHERE key = 'default_user_budget_usd'), 25) INTO starting;

  INSERT INTO public.profiles (id, email, full_name, signup_intent, starting_credit_usd)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), requested_intent, starting);

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;