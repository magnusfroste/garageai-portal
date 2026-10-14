CREATE TABLE public.bridge_release_runs (
  version text PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  garages_seen text[] NOT NULL DEFAULT '{}',
  update_errors integer NOT NULL DEFAULT 0,
  error_garages text[] NOT NULL DEFAULT '{}',
  last_error text
);
GRANT SELECT ON public.bridge_release_runs TO authenticated;
GRANT ALL ON public.bridge_release_runs TO service_role;
ALTER TABLE public.bridge_release_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read bridge release runs" ON public.bridge_release_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Records one heartbeat from an admin-owned or canary garage; other garages are ignored.
-- _error_version: the version an update error is about (the target the garage was offered).
CREATE OR REPLACE FUNCTION public.record_bridge_run(_garage_id uuid, _version text, _error text, _error_version text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record;
BEGIN
  SELECT id, name, operator_id, canary INTO g FROM garages WHERE id = _garage_id;
  IF g IS NULL OR NOT (g.canary OR (g.operator_id IS NOT NULL AND public.has_role(g.operator_id, 'admin'))) THEN RETURN; END IF;
  IF _version IS NOT NULL AND _version ~ '^v[0-9]+\.[0-9]+\.[0-9]+' THEN
    INSERT INTO bridge_release_runs(version, garages_seen) VALUES (_version, ARRAY[g.name])
    ON CONFLICT (version) DO UPDATE SET last_seen_at = now(),
      garages_seen = CASE WHEN g.name = ANY(bridge_release_runs.garages_seen) THEN bridge_release_runs.garages_seen ELSE bridge_release_runs.garages_seen || g.name END;
  END IF;
  IF _error IS NOT NULL AND _error_version IS NOT NULL AND _error_version ~ '^v[0-9]+\.[0-9]+\.[0-9]+' THEN
    INSERT INTO bridge_release_runs(version, first_seen_at, last_seen_at, garages_seen, error_garages, update_errors, last_error)
    VALUES (_error_version, 'infinity', 'infinity', '{}', ARRAY[g.name], 1, left(_error, 300))
    ON CONFLICT (version) DO UPDATE SET last_error = left(_error, 300),
      error_garages = CASE WHEN g.name = ANY(bridge_release_runs.error_garages) THEN bridge_release_runs.error_garages ELSE bridge_release_runs.error_garages || g.name END,
      update_errors = cardinality(CASE WHEN g.name = ANY(bridge_release_runs.error_garages) THEN bridge_release_runs.error_garages ELSE bridge_release_runs.error_garages || g.name END);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_bridge_run(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_bridge_run(uuid, text, text, text) TO service_role;