ALTER TABLE public.profiles ADD COLUMN terms_notice_dismissed_version text;
CREATE OR REPLACE FUNCTION public.account_terms_version() RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT '2026-10-25'::text $$;
CREATE OR REPLACE FUNCTION public.account_terms_valid(_version text, _at timestamptz DEFAULT now()) RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$ SELECT coalesce(_version = public.account_terms_version() OR (_version = '2026-10-17' AND _at < timestamptz '2026-11-09 00:00:00+00'), false) $$;
REVOKE ALL ON FUNCTION public.account_terms_valid(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_terms_valid(text, timestamptz) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.require_account_terms_for_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND public.account_terms_valid(terms_version)) THEN RAISE EXCEPTION 'Please accept the Terms and Privacy policy in the banner above before continuing.' USING ERRCODE = '42501'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.dismiss_account_terms_notice(_version text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
 IF _version IS DISTINCT FROM public.account_terms_version() THEN RAISE EXCEPTION 'Current terms version required' USING ERRCODE = '22023'; END IF;
 UPDATE public.profiles SET terms_notice_dismissed_version = _version WHERE id = auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.dismiss_account_terms_notice(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_account_terms_notice(text) TO authenticated;