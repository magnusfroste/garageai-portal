CREATE OR REPLACE FUNCTION public.garage_public_locations()
 RETURNS TABLE(garage_name text, country text, location_display text, location_source text, is_endpoint boolean, live_hours_per_week numeric, live_hours_total numeric, is_new boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH s AS (
    SELECT g.id,
      (SELECT ss.first_sampled_at FROM public.garage_status_summary ss WHERE ss.garage_id = g.id) AS first_at,
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
  WHERE NOT g.disabled AND g.visibility = 'market';
$function$;
CREATE OR REPLACE FUNCTION public.garage_public_stats()
 RETURNS TABLE(garage_name text, runtime text, online boolean, tokens_7d bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT g.name, g.runtime,
    g.paused_at IS NULL AND g.status = 'online' AND g.runtime_ok IS DISTINCT FROM false AND EXISTS (
      SELECT 1 FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed AND gm.paused_at IS NULL AND gm.status = 'live'
    ),
    coalesce((SELECT sum(h.completion_tokens) FROM public.customer_garage_request_stats_hourly h WHERE h.garage_id = g.id AND h.hour >= now() - interval '7 days'), 0)::bigint
  FROM public.garages g WHERE NOT g.disabled AND g.visibility = 'market' AND (
    EXISTS (SELECT 1 FROM public.garage_status_summary ss WHERE ss.garage_id = g.id AND ss.first_online_at IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed)
  );
$function$;
CREATE OR REPLACE FUNCTION public.garage_profile(_name text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'name', g.name,
    'display_name', coalesce(nullif(g.display_name, ''), g.name),
    'runtime', g.runtime,
    'models', (SELECT coalesce(jsonb_agg(DISTINCT gm.canonical_model), '[]'::jsonb) FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed AND gm.paused_at IS NULL),
    'status', g.status,
    'disabled', g.disabled,
    'paused', g.paused_at IS NOT NULL,
    'online', g.paused_at IS NULL AND g.status = 'online' AND g.runtime_ok IS DISTINCT FROM false AND EXISTS (SELECT 1 FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed AND gm.paused_at IS NULL AND gm.status = 'live'),
    'active_since', coalesce((SELECT ss.first_sampled_at FROM public.garage_status_summary ss WHERE ss.garage_id = g.id), g.created_at),
    'total_tokens', (SELECT coalesce(sum(completion_tokens), 0) FROM public.customer_garage_request_stats_hourly WHERE garage_id = g.id),
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
  WHERE g.name = _name AND NOT g.disabled AND g.visibility = 'market' AND (
    EXISTS (SELECT 1 FROM public.garage_status_summary ss WHERE ss.garage_id = g.id AND ss.first_online_at IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed)
  );
$function$;
CREATE OR REPLACE FUNCTION public.garage_reliability(_names text[] DEFAULT NULL::text[])
 RETURNS TABLE(garage_name text, period text, availability numeric, success_rate numeric, requests bigint, ttft_ms_p50 numeric, tokens_per_second numeric, score numeric, grade text, sample_days numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH g AS (
    SELECT id, name FROM public.garages WHERE visibility = 'market' AND (_names IS NULL OR name = ANY(_names))
  ),
  w AS (
    SELECT * FROM (VALUES ('24h', interval '24 hours'), ('7d', interval '7 days'), ('30d', interval '30 days')) v(period, span)
  ),
  first_s AS (
    SELECT ss.garage_id, ss.first_sampled_at AS first_at FROM public.garage_status_summary ss JOIN g ON g.id = ss.garage_id
  ),
  avail AS (
    SELECT g.id, w.period, avg(CASE WHEN s.online THEN 1.0 ELSE 0.0 END) AS a
    FROM g CROSS JOIN w
    LEFT JOIN public.garage_status_samples s ON s.garage_id = g.id AND s.sampled_at >= now() - w.span
    GROUP BY g.id, w.period
  ),
  req AS (
    SELECT g.id, w.period, sum(h.requests)::bigint AS reqs, sum(h.failures)::bigint AS fails,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY h.ttft_ms_p50) AS ttft
    FROM g CROSS JOIN w
    LEFT JOIN public.customer_garage_request_stats_hourly h ON h.garage_id = g.id AND h.hour >= now() - w.span
    GROUP BY g.id, w.period
  ),
  probe_ttft AS (
    SELECT g.id, w.period, percentile_cont(0.5) WITHIN GROUP (ORDER BY t.ttft_ms) AS ttft
    FROM g CROSS JOIN w
    LEFT JOIN public.garage_model_tests t ON t.garage_id = g.id AND t.passed AND t.tested_at >= now() - w.span
    GROUP BY g.id, w.period
  ),
  speed AS (
    SELECT g.id, percentile_cont(0.5) WITHIN GROUP (ORDER BY x.v) AS tps
    FROM g LEFT JOIN (
      SELECT garage_id, tokens_per_second_p50 AS v FROM public.customer_garage_request_stats_hourly
        WHERE hour >= now() - interval '7 days' AND tokens_per_second_p50 > 0
      UNION ALL
      SELECT garage_id, tokens_per_second FROM public.garage_model_tests
        WHERE tested_at >= now() - interval '7 days' AND passed AND tokens_per_second > 0
    ) x ON x.garage_id = g.id
    GROUP BY g.id
  ),
  calc AS (
    SELECT g.name, w.period, a.a AS availability,
      CASE WHEN coalesce(r.reqs, 0) > 0 THEN 1 - r.fails::numeric / r.reqs END AS success_rate,
      coalesce(r.reqs, 0) AS requests,
      coalesce(r.ttft, p.ttft)::numeric AS ttft,
      sp.tps::numeric AS tps,
      CASE WHEN f.first_at IS NULL THEN 0 ELSE extract(epoch FROM now() - f.first_at) / 86400 END AS sample_days
    FROM g CROSS JOIN w
    JOIN avail a ON a.id = g.id AND a.period = w.period
    JOIN req r ON r.id = g.id AND r.period = w.period
    JOIN probe_ttft p ON p.id = g.id AND p.period = w.period
    JOIN speed sp ON sp.id = g.id
    LEFT JOIN first_s f ON f.garage_id = g.id
  )
  SELECT name, period, round(availability, 4), round(success_rate, 4), requests,
    round(ttft), round(tps, 1),
    CASE WHEN availability IS NULL THEN NULL ELSE round(
      50 * availability + 30 * coalesce(success_rate, availability) + 20 * least(1, coalesce(tps, 0) / 30), 1) END AS score,
    CASE
      WHEN sample_days < 7 OR availability IS NULL THEN 'Nytt'
      WHEN 50 * availability + 30 * coalesce(success_rate, availability) + 20 * least(1, coalesce(tps, 0) / 30) >= 95 THEN 'A'
      WHEN 50 * availability + 30 * coalesce(success_rate, availability) + 20 * least(1, coalesce(tps, 0) / 30) >= 85 THEN 'B'
      WHEN 50 * availability + 30 * coalesce(success_rate, availability) + 20 * least(1, coalesce(tps, 0) / 30) >= 70 THEN 'C'
      ELSE 'D' END AS grade,
    round(sample_days::numeric, 1)
  FROM calc
$function$;
CREATE OR REPLACE FUNCTION public.garage_offline_periods(_name text, _limit integer DEFAULT 5)
 RETURNS TABLE(started_at timestamp with time zone, ended_at timestamp with time zone, duration_seconds numeric, reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH g AS (
    SELECT id FROM public.garages
    WHERE name = _name AND (operator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ),
  s AS (
    SELECT sampled_at, online, reason,
      row_number() OVER (ORDER BY sampled_at) - row_number() OVER (PARTITION BY online ORDER BY sampled_at) AS grp
    FROM public.garage_status_samples WHERE garage_id = (SELECT id FROM g) AND sampled_at >= now() - interval '30 days'
  ),
  islands AS (
    SELECT grp, min(sampled_at) AS started_at, max(sampled_at) AS last_at,
      mode() WITHIN GROUP (ORDER BY reason) AS reason
    FROM s WHERE NOT online GROUP BY grp
  )
  SELECT i.started_at,
    (SELECT min(sampled_at) FROM s WHERE s.online AND s.sampled_at > i.last_at) AS ended_at,
    extract(epoch FROM coalesce((SELECT min(sampled_at) FROM s WHERE s.online AND s.sampled_at > i.last_at), now()) - i.started_at)::numeric,
    i.reason
  FROM islands i
  ORDER BY i.started_at DESC
  LIMIT greatest(1, least(_limit, 50))
$function$;
COMMENT ON TABLE public.garage_status_summary IS 'All-time per-garage status facts (first sample, first/last online); public status functions read these so garage_status_samples can be pruned to 30 days. Backend-only, maintained by insert trigger.';