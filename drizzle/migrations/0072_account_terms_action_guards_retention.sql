CREATE OR REPLACE FUNCTION public.require_account_terms_for_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND terms_version = public.account_terms_version()) THEN RAISE EXCEPTION 'Please accept the Terms and Privacy policy in the banner above before continuing.' USING ERRCODE = '42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER api_keys_require_account_terms BEFORE INSERT ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.require_account_terms_for_insert();
CREATE TRIGGER garages_require_account_terms BEFORE INSERT ON public.garages FOR EACH ROW EXECUTE FUNCTION public.require_account_terms_for_insert();
CREATE OR REPLACE FUNCTION public.prune_onboarding_events() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE removed bigint;
BEGIN
 DELETE FROM public.onboarding_events WHERE created_at < now() - interval '12 months';
 GET DIAGNOSTICS removed = ROW_COUNT;
 RETURN removed;
END $$;
REVOKE ALL ON FUNCTION public.prune_onboarding_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_onboarding_events() TO service_role;