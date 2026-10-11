CREATE TABLE public.bridge_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code_hash text NOT NULL UNIQUE,
  user_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','picked_up','expired')),
  machine_id text, hostname text, os text, arch text, bridge_version text, gpu text, memory_gb int, runtime text,
  models jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_name text,
  requested_ip_country text,
  requested_ip_hash text,
  garage_id uuid REFERENCES public.garages(id) ON DELETE SET NULL,
  approved_by uuid,
  credentials jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  approved_at timestamptz,
  last_poll_at timestamptz,
  picked_up_at timestamptz
);
CREATE INDEX bridge_links_ip_created_idx ON public.bridge_links (requested_ip_hash, created_at);
CREATE INDEX bridge_links_created_idx ON public.bridge_links (created_at);
GRANT ALL ON public.bridge_links TO service_role;
ALTER TABLE public.bridge_links ENABLE ROW LEVEL SECURITY;
COMMENT ON COLUMN public.bridge_links.requested_ip_hash IS 'sha256 of the requesting IP, only for the start rate limit; raw IPs are never stored';

ALTER TABLE public.garages ADD COLUMN machine_id text, ADD COLUMN machine_hostname text, ADD COLUMN last_machine_id text;
ALTER TABLE public.onboarding_events ADD COLUMN machine_id text;