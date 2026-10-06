ALTER TABLE public.garages
  ADD COLUMN IF NOT EXISTS paused_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS paused_reason text NULL,
  ADD COLUMN IF NOT EXISTS measured_country char(2) NULL,
  ADD COLUMN IF NOT EXISTS measured_country_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS location_display text NOT NULL DEFAULT 'country',
  ADD COLUMN IF NOT EXISTS declared_country char(2) NULL,
  ADD COLUMN IF NOT EXISTS country_override char(2) NULL;
ALTER TABLE public.garages ADD CONSTRAINT garages_location_display_check CHECK (location_display IN ('country','region','hidden'));
ALTER TABLE public.garage_models ADD COLUMN IF NOT EXISTS paused_at timestamptz NULL;

CREATE TABLE public.garage_country_history (
  id bigserial PRIMARY KEY,
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  country char(2) NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX garage_country_history_garage_idx ON public.garage_country_history (garage_id, seen_at DESC);
GRANT SELECT ON public.garage_country_history TO authenticated;
GRANT ALL ON public.garage_country_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.garage_country_history_id_seq TO service_role;
ALTER TABLE public.garage_country_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read country history" ON public.garage_country_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.record_garage_country()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.measured_country IS NOT NULL AND NEW.measured_country IS DISTINCT FROM OLD.measured_country THEN
    INSERT INTO public.garage_country_history (garage_id, country) VALUES (NEW.id, NEW.measured_country);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_garage_country() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER garages_country_history AFTER UPDATE OF measured_country ON public.garages
  FOR EACH ROW EXECUTE FUNCTION public.record_garage_country();

-- Operator: choose how the location is shown (never the country itself).
CREATE OR REPLACE FUNCTION public.set_garage_location_display(_garage_id uuid, _mode text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _mode NOT IN ('country','region','hidden') THEN RAISE EXCEPTION 'invalid location display'; END IF;
  UPDATE public.garages SET location_display = _mode
   WHERE id = _garage_id AND (operator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
  IF NOT FOUND THEN RAISE EXCEPTION 'garage not found'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_garage_location_display(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_garage_location_display(uuid, text) TO authenticated;

-- Public location + availability per garage (country is null when hidden; never an IP or city).
CREATE OR REPLACE FUNCTION public.garage_public_locations()
RETURNS TABLE(garage_name text, country text, location_display text, location_source text, is_endpoint boolean, live_hours_per_week numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.name,
    CASE WHEN g.location_display = 'hidden' THEN NULL
         ELSE upper(COALESCE(g.country_override, CASE WHEN g.connection_type = 'endpoint' THEN g.declared_country ELSE g.measured_country END)) END,
    g.location_display,
    CASE WHEN g.country_override IS NOT NULL THEN 'admin' WHEN g.connection_type = 'endpoint' THEN 'provider' ELSE 'measured' END,
    g.connection_type = 'endpoint',
    CASE WHEN g.connection_type = 'endpoint' THEN NULL ELSE round((
      SELECT count(*) FILTER (WHERE s.online) FROM public.garage_status_samples s
       WHERE s.garage_id = g.id AND s.sampled_at >= now() - interval '28 days'
    ) * (5.0 / 60.0) / 4.0, 1) END
  FROM public.garages g
  WHERE NOT g.disabled;
$$;
GRANT EXECUTE ON FUNCTION public.garage_public_locations() TO anon, authenticated;