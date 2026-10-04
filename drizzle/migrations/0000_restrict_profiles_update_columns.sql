-- Restrict which columns the authenticated role may UPDATE on public.profiles.
-- Column-level UPDATE privilege: users may only change their own profile's
-- display fields; credits and LiteLLM linkage remain server-side only.

REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;
GRANT UPDATE (full_name, company) ON public.profiles TO authenticated;

COMMENT ON TABLE public.profiles IS 'Column-level UPDATE restricted: authenticated role may update only full_name and company (migration restrict_profiles_update_columns). purchased_credits_usd and litellm_user_id are server-side only.';