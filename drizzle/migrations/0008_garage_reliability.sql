CREATE TABLE IF NOT EXISTS public.garage_status_samples (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  sampled_at timestamptz NOT NULL DEFAULT now(),
  online boolean NOT NULL,
  reason text NULL CHECK (reason IS NULL OR reason IN ('no_heartbeat','mesh_disconnected','no_models'))
);
CREATE INDEX IF NOT EXISTS garage_status_samples_garage_time_idx ON public.garage_status_samples (garage_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS garage_status_samples_time_idx ON public.garage_status_samples (sampled_at);
GRANT ALL ON public.garage_status_samples TO service_role;
ALTER TABLE public.garage_status_samples ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.garage_request_stats_hourly (
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  hour timestamptz NOT NULL,
  requests int NOT NULL DEFAULT 0,
  failures int NOT NULL DEFAULT 0,
  ttft_ms_p50 int NULL,
  tokens_per_second_p50 numeric NULL,
  completion_tokens bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (garage_id, hour)
);
GRANT ALL ON public.garage_request_stats_hourly TO service_role;
ALTER TABLE public.garage_request_stats_hourly ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ingest_cursors (
  name text PRIMARY KEY,
  value timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ingest_cursors TO service_role;
ALTER TABLE public.ingest_cursors ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.garage_reliability(_names text[] DEFAULT NULL)
RETURNS TABLE (
  garage_name text, period text, availability numeric, success_rate numeric,
  requests bigint, ttft_ms_p50 numeric, tokens_per_second numeric,
  score numeric, grade text, sample_days numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH g AS (
    SELECT id, name FROM public.garages WHERE _names IS NULL OR name = ANY(_names)
  ),
  w AS (
    SELECT * FROM (VALUES ('24h', interval '24 hours'), ('7d', interval '7 days'), ('30d', interval '30 days')) v(period, span)
  ),
  first_s AS (
    SELECT s.garage_id, min(s.sampled_at) AS first_at FROM public.garage_status_samples s JOIN g ON g.id = s.garage_id GROUP BY s.garage_id
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
    LEFT JOIN public.garage_request_stats_hourly h ON h.garage_id = g.id AND h.hour >= now() - w.span
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
      SELECT garage_id, tokens_per_second_p50 AS v FROM public.garage_request_stats_hourly
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
$$;

CREATE OR REPLACE FUNCTION public.garage_profile(_name text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'name', g.name,
    'runtime', g.runtime,
    'models', to_jsonb(g.models),
    'status', g.status,
    'disabled', g.disabled,
    'active_since', coalesce((SELECT min(sampled_at) FROM public.garage_status_samples WHERE garage_id = g.id), g.created_at),
    'total_tokens', (SELECT coalesce(sum(completion_tokens), 0) FROM public.garage_request_stats_hourly WHERE garage_id = g.id),
    'daily', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'online_pct', d.pct, 'samples', d.n) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT days.day::date AS day,
          round(100 * avg(CASE WHEN s.online THEN 1.0 ELSE 0.0 END), 1) AS pct,
          count(s.id) AS n
        FROM generate_series((now() - interval '29 days')::date, now()::date, interval '1 day') AS days(day)
        LEFT JOIN public.garage_status_samples s ON s.garage_id = g.id AND s.sampled_at::date = days.day::date
        GROUP BY days.day
      ) d
    )
  )
  FROM public.garages g WHERE g.name = _name
$$;

CREATE OR REPLACE FUNCTION public.garage_offline_periods(_name text, _limit int DEFAULT 5)
RETURNS TABLE (started_at timestamptz, ended_at timestamptz, duration_seconds numeric, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH g AS (
    SELECT id FROM public.garages
    WHERE name = _name AND (operator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ),
  s AS (
    SELECT sampled_at, online, reason,
      row_number() OVER (ORDER BY sampled_at) - row_number() OVER (PARTITION BY online ORDER BY sampled_at) AS grp
    FROM public.garage_status_samples WHERE garage_id = (SELECT id FROM g)
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
$$;

REVOKE ALL ON FUNCTION public.garage_reliability(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.garage_profile(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.garage_offline_periods(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garage_reliability(text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.garage_profile(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.garage_offline_periods(text, int) TO authenticated, service_role;