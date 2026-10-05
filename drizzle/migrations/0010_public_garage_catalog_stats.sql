-- Public, aggregate-only garage stats for the model catalogue (no emails, IPs, tokens).
CREATE OR REPLACE FUNCTION public.garage_public_stats()
RETURNS TABLE (garage_name text, runtime text, online boolean, tokens_7d bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT g.name, g.runtime, (g.status = 'online' AND NOT g.disabled),
    coalesce((SELECT sum(h.completion_tokens) FROM public.garage_request_stats_hourly h
              WHERE h.garage_id = g.id AND h.hour >= now() - interval '7 days'), 0)::bigint
  FROM public.garages g
$$;

CREATE OR REPLACE FUNCTION public.garage_daily_tokens(_names text[])
RETURNS TABLE (garage_name text, day date, tokens bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT g.name, h.hour::date, sum(h.completion_tokens)::bigint
  FROM public.garages g
  JOIN public.garage_request_stats_hourly h ON h.garage_id = g.id
  WHERE g.name = ANY(_names) AND h.hour >= now() - interval '30 days'
  GROUP BY g.name, h.hour::date
$$;

REVOKE ALL ON FUNCTION public.garage_public_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.garage_daily_tokens(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.garage_public_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.garage_daily_tokens(text[]) TO anon, authenticated;