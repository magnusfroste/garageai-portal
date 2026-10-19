DROP POLICY IF EXISTS "Users can delete own API keys" ON public.api_keys;
REVOKE DELETE ON public.api_keys FROM authenticated, anon;