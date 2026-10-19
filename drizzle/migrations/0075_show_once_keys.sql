ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS key_last4 text;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'user';
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS device_label text;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_kind_check CHECK (kind IN ('user','default','chat'));
UPDATE public.api_keys SET key_last4 = right(key_value, 4) WHERE key_last4 IS NULL AND key_value LIKE 'sk-%';
UPDATE public.api_keys SET litellm_token = encode(sha256(key_value::bytea), 'hex') WHERE litellm_token IS NULL AND key_value LIKE 'sk-%';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_key_at timestamptz;
UPDATE public.profiles p SET default_key_at = now() WHERE default_key_at IS NULL AND EXISTS (SELECT 1 FROM public.api_keys k WHERE k.user_id = p.id);

-- Rename changes only the portal name, never the gateway alias.
CREATE OR REPLACE FUNCTION public.rename_api_key(_id uuid, _name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n text := btrim(coalesce(_name, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF length(n) < 1 OR length(n) > 80 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  UPDATE public.api_keys SET name = n WHERE id = _id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.rename_api_key(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rename_api_key(uuid, text) TO authenticated;

-- Chat keys with no customer traffic in 30 days (and older than 30 days).
CREATE OR REPLACE FUNCTION public.stale_chat_keys(_days integer DEFAULT 30)
RETURNS TABLE(id uuid, litellm_token text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT k.id, k.litellm_token FROM public.api_keys k
  WHERE k.kind = 'chat' AND k.is_active AND k.revoked_at IS NULL
    AND k.created_at < now() - make_interval(days => _days)
    AND NOT EXISTS (
      SELECT 1 FROM public.customer_garage_model_stats_hourly s
      WHERE s.hour >= now() - make_interval(days => _days)
        AND k.litellm_token IS NOT NULL
        AND encode(sha256(k.litellm_token::bytea), 'hex') = ANY(s.api_keys))
$$;
REVOKE ALL ON FUNCTION public.stale_chat_keys(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stale_chat_keys(integer) TO service_role;