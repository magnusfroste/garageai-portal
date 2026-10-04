CREATE TABLE IF NOT EXISTS public.garages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL CHECK (name ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  operator_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  api_host text NULL,
  runtime text,
  port int,
  models text[] NOT NULL DEFAULT '{}',
  mesh_ip text,
  netbird_peer_id text,
  status text NOT NULL DEFAULT 'pending',
  dedicated_input_cost_per_million numeric NOT NULL DEFAULT 0.30,
  dedicated_output_cost_per_million numeric NOT NULL DEFAULT 1.20,
  pool_input_cost_per_million numeric NOT NULL DEFAULT 0.15,
  pool_output_cost_per_million numeric NOT NULL DEFAULT 0.60,
  last_registered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garages TO authenticated;
GRANT ALL ON public.garages TO service_role;
ALTER TABLE public.garages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage garages" ON public.garages;
CREATE POLICY "Admins manage garages" ON public.garages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Operators view own garages" ON public.garages;
CREATE POLICY "Operators view own garages" ON public.garages FOR SELECT TO authenticated
  USING (operator_id = auth.uid());
DROP TRIGGER IF EXISTS update_garages_updated_at ON public.garages;
CREATE TRIGGER update_garages_updated_at BEFORE UPDATE ON public.garages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.garage_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz NULL
);
CREATE INDEX IF NOT EXISTS garage_tokens_garage_id_idx ON public.garage_tokens(garage_id);
GRANT ALL ON public.garage_tokens TO service_role;
ALTER TABLE public.garage_tokens ENABLE ROW LEVEL SECURITY;