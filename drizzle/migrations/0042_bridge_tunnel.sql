ALTER TABLE public.garages ADD COLUMN IF NOT EXISTS transport text NOT NULL DEFAULT 'netbird';
ALTER TABLE public.garages ADD COLUMN IF NOT EXISTS tunnel_public_key text;
ALTER TABLE public.garages ADD COLUMN IF NOT EXISTS tunnel_ip text;
ALTER TABLE public.garages ADD COLUMN IF NOT EXISTS tunnel_assigned_at timestamptz;
ALTER TABLE public.garages ADD CONSTRAINT garages_transport_check CHECK (transport IN ('netbird','tunnel'));
ALTER TABLE public.garages ADD CONSTRAINT garages_tunnel_public_key_key UNIQUE (tunnel_public_key);
ALTER TABLE public.garages ADD CONSTRAINT garages_tunnel_ip_key UNIQUE (tunnel_ip);