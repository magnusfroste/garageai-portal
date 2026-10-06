CREATE POLICY "Public can read starter credit" ON public.admin_settings FOR SELECT TO anon, authenticated USING (key = 'default_user_budget_usd');
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE user_count int; requested_intent text; starting numeric;
BEGIN
  requested_intent := NEW.raw_user_meta_data->>'signup_intent';
  IF requested_intent NOT IN ('buyer', 'operator') THEN requested_intent := NULL; END IF;
  SELECT greatest(coalesce((SELECT nullif(value #>> '{}', '')::numeric FROM public.admin_settings WHERE key = 'default_user_budget_usd'), 0), 0) INTO starting;
  INSERT INTO public.profiles (id, email, full_name, signup_intent, starting_credit_usd)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), requested_intent, starting);
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;