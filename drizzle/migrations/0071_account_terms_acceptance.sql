ALTER TABLE public.profiles ADD COLUMN terms_version text, ADD COLUMN terms_accepted_at timestamptz;
CREATE OR REPLACE FUNCTION public.account_terms_version() RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT '2026-10-17'::text $$;
CREATE OR REPLACE FUNCTION public.guard_account_terms() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF (NEW.terms_version IS DISTINCT FROM OLD.terms_version OR NEW.terms_accepted_at IS DISTINCT FROM OLD.terms_accepted_at) AND current_user NOT IN ('postgres', 'supabase_admin') THEN
 RAISE EXCEPTION 'Use accept_account_terms to record acceptance' USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER profiles_guard_account_terms BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_account_terms();
CREATE OR REPLACE FUNCTION public.accept_account_terms(_version text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
 IF _version IS DISTINCT FROM public.account_terms_version() THEN RAISE EXCEPTION 'Current terms version required' USING ERRCODE = '22023'; END IF;
 UPDATE public.profiles SET terms_version = public.account_terms_version(), terms_accepted_at = now() WHERE id = auth.uid() AND terms_version IS DISTINCT FROM public.account_terms_version();
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN RAISE EXCEPTION 'Profile not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.accept_account_terms(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_account_terms(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count int; requested_intent text; starting numeric; accepted boolean;
BEGIN
 accepted := NEW.raw_user_meta_data->>'account_terms_accepted' = 'true' AND NEW.raw_user_meta_data->>'account_terms_version' = public.account_terms_version();
 IF coalesce(NEW.raw_app_meta_data->>'provider', 'email') = 'email' AND accepted IS NOT TRUE THEN RAISE EXCEPTION 'Please accept the Terms and Privacy policy'; END IF;
 requested_intent := NEW.raw_user_meta_data->>'signup_intent';
 IF requested_intent NOT IN ('buyer', 'operator') THEN requested_intent := NULL; END IF;
 SELECT greatest(coalesce((SELECT nullif(value #>> '{}', '')::numeric FROM public.admin_settings WHERE key = 'default_user_budget_usd'), 0), 0) INTO starting;
 INSERT INTO public.profiles (id, email, full_name, signup_intent, starting_credit_usd, terms_version, terms_accepted_at)
 VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), requested_intent, starting, CASE WHEN accepted THEN public.account_terms_version() END, CASE WHEN accepted THEN now() END);
 SELECT COUNT(*) INTO user_count FROM auth.users;
 IF user_count = 1 THEN INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT (user_id, role) DO NOTHING; END IF;
 RETURN NEW;
END $$;