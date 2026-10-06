CREATE OR REPLACE FUNCTION public.garage_profile(_name text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'name', g.name,
    'display_name', coalesce(nullif(g.display_name, ''), g.name),
    'runtime', g.runtime,
    'models', (SELECT coalesce(jsonb_agg(DISTINCT gm.canonical_model), '[]'::jsonb) FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed AND gm.paused_at IS NULL),
    'status', g.status,
    'disabled', g.disabled,
    'paused', g.paused_at IS NOT NULL,
    'online', g.paused_at IS NULL AND g.status = 'online' AND g.runtime_ok IS DISTINCT FROM false AND EXISTS (SELECT 1 FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed AND gm.paused_at IS NULL AND gm.status = 'live'),
    'active_since', coalesce((SELECT min(sampled_at) FROM public.garage_status_samples WHERE garage_id = g.id), g.created_at),
    'total_tokens', (SELECT coalesce(sum(completion_tokens), 0) FROM public.garage_request_stats_hourly WHERE garage_id = g.id),
    'daily', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'online_pct', d.pct, 'samples', d.n) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT days.day::date AS day, round(100 * avg(CASE WHEN s.online THEN 1.0 ELSE 0.0 END), 1) AS pct, count(s.id) AS n
        FROM generate_series((now() - interval '29 days')::date, now()::date, interval '1 day') AS days(day)
        LEFT JOIN public.garage_status_samples s ON s.garage_id = g.id AND s.sampled_at::date = days.day::date
        GROUP BY days.day
      ) d
    )
  ) FROM public.garages g
  WHERE g.name = _name AND NOT g.disabled AND (
    EXISTS (SELECT 1 FROM public.garage_status_samples s WHERE s.garage_id = g.id AND s.online)
    OR EXISTS (SELECT 1 FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.garage_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.garage_profile(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.garage_public_stats()
RETURNS TABLE(garage_name text, runtime text, online boolean, tokens_7d bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.name, g.runtime,
    g.paused_at IS NULL AND g.status = 'online' AND g.runtime_ok IS DISTINCT FROM false AND EXISTS (
      SELECT 1 FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed AND gm.paused_at IS NULL AND gm.status = 'live'
    ),
    coalesce((SELECT sum(h.completion_tokens) FROM public.garage_request_stats_hourly h WHERE h.garage_id = g.id AND h.hour >= now() - interval '7 days'), 0)::bigint
  FROM public.garages g WHERE NOT g.disabled AND (
    EXISTS (SELECT 1 FROM public.garage_status_samples s WHERE s.garage_id = g.id AND s.online)
    OR EXISTS (SELECT 1 FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.garage_public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.garage_public_stats() TO anon, authenticated, service_role;