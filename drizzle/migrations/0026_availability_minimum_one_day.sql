DROP FUNCTION IF EXISTS public.garage_public_locations();
CREATE FUNCTION public.garage_public_locations()
RETURNS TABLE(garage_name text, country text, location_display text, location_source text, is_endpoint boolean, live_hours_per_week numeric, live_hours_total numeric, is_new boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (
    SELECT g.id,
      (SELECT min(x.sampled_at) FROM public.garage_status_samples x WHERE x.garage_id = g.id) AS first_at,
      (SELECT count(*) FILTER (WHERE x.online) FROM public.garage_status_samples x
        WHERE x.garage_id = g.id AND x.sampled_at >= now() - interval '28 days') AS online_n
    FROM public.garages g
  )
  SELECT g.name,
    CASE WHEN g.location_display = 'hidden' THEN NULL
         ELSE upper(COALESCE(g.country_override, CASE WHEN g.connection_type = 'endpoint' THEN g.declared_country ELSE g.measured_country END)) END,
    g.location_display,
    CASE WHEN g.country_override IS NOT NULL THEN 'admin' WHEN g.connection_type = 'endpoint' THEN 'provider' ELSE 'measured' END,
    g.connection_type = 'endpoint',
    -- weeks observed: min 1 day (1/7 week), max 4 weeks
    CASE WHEN g.connection_type = 'endpoint' OR s.first_at IS NULL THEN NULL ELSE round(
      s.online_n * (5.0 / 60.0)
      / greatest(1.0 / 7.0, least(4.0, extract(epoch FROM now() - s.first_at) / 86400.0 / 7.0)), 1) END,
    CASE WHEN g.connection_type = 'endpoint' OR s.first_at IS NULL THEN NULL ELSE round(s.online_n * (5.0 / 60.0), 1) END,
    CASE WHEN g.connection_type = 'endpoint' OR s.first_at IS NULL THEN NULL ELSE now() - s.first_at < interval '24 hours' END
  FROM public.garages g JOIN s ON s.id = g.id
  WHERE NOT g.disabled;
$$;
REVOKE EXECUTE ON FUNCTION public.garage_public_locations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.garage_public_locations() TO anon, authenticated;