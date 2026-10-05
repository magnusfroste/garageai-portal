ALTER TABLE public.garages
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS garages_last_heartbeat_at_idx
  ON public.garages (last_heartbeat_at)
  WHERE last_heartbeat_at IS NOT NULL;