DROP FUNCTION IF EXISTS public.garage_revenue(timestamptz, timestamptz);
CREATE FUNCTION public.garage_revenue(_from timestamptz, _to timestamptz)
 RETURNS TABLE(garage_name text, display_name text, connection_type text, model text, runtime_models text[], requests bigint, failures bigint, prompt_tokens bigint, completion_tokens bigint, spend_usd numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(g.name, s.garage_name, s.garage_id::text), coalesce(g.display_name, s.garage_name || ' (deleted)'), coalesce(g.connection_type, 'deleted'),
    coalesce(gm.canonical_model, s.model),
    array_agg(DISTINCT s.model ORDER BY s.model),
    sum(s.requests)::bigint, sum(s.failures)::bigint, sum(s.prompt_tokens)::bigint, sum(s.completion_tokens)::bigint, coalesce(sum(s.spend_usd), 0)
  FROM public.garage_model_stats_hourly s
  LEFT JOIN public.garages g ON g.id = s.garage_id
  LEFT JOIN public.garage_models gm ON gm.garage_id = s.garage_id AND gm.model = s.model
  WHERE public.has_role(auth.uid(), 'admin') AND s.hour >= _from AND s.hour < _to
  GROUP BY 1, 2, 3, 4
$function$;
REVOKE ALL ON FUNCTION public.garage_revenue(timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.garage_revenue(timestamptz, timestamptz) TO authenticated, service_role;