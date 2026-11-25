CREATE TABLE public.management_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_last4 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  window_start timestamptz NOT NULL DEFAULT now(),
  window_count integer NOT NULL DEFAULT 0
);
CREATE INDEX management_keys_user_idx ON public.management_keys(user_id);
GRANT SELECT (id, user_id, name, key_last4, created_at, expires_at, revoked_at, last_used_at) ON public.management_keys TO authenticated;
GRANT ALL ON public.management_keys TO service_role;
ALTER TABLE public.management_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own management keys" ON public.management_keys FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.customer_key_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  management_key_id uuid REFERENCES public.management_keys(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create','update','disable','enable','delete')),
  key_hash text,
  changed_fields text[] NOT NULL DEFAULT '{}',
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_key_events_user_idx ON public.customer_key_events(user_id, at DESC);
GRANT SELECT ON public.customer_key_events TO authenticated;
GRANT ALL ON public.customer_key_events TO service_role;
ALTER TABLE public.customer_key_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own key events" ON public.customer_key_events FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS limit_usd numeric CHECK (limit_usd IS NULL OR limit_usd >= 0);
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS limit_reset text CHECK (limit_reset IS NULL OR limit_reset IN ('daily','weekly','monthly'));
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS rpm integer CHECK (rpm IS NULL OR rpm > 0);
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS models text[];
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_kind_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_kind_check CHECK (kind IN ('user','default','chat','managed'));

-- Authenticates a management key by hash, records use and enforces 60 calls/minute atomically.
CREATE OR REPLACE FUNCTION public.management_key_auth(_hash text, _limit integer DEFAULT 60)
RETURNS TABLE(id uuid, user_id uuid, allowed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.management_keys m SET
    last_used_at = now(),
    window_start = CASE WHEN m.window_start <= now() - interval '1 minute' THEN now() ELSE m.window_start END,
    window_count = CASE WHEN m.window_start <= now() - interval '1 minute' THEN 1 ELSE m.window_count + 1 END
  WHERE m.key_hash = _hash AND m.revoked_at IS NULL AND (m.expires_at IS NULL OR m.expires_at > now())
  RETURNING m.id, m.user_id, (m.window_count <= _limit);
END $$;
REVOKE ALL ON FUNCTION public.management_key_auth(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.management_key_auth(text, integer) TO service_role;