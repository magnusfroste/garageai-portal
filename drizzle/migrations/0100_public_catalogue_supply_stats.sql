CREATE OR REPLACE FUNCTION public.model_public_daily()
RETURNS TABLE(model text, day date, requests bigint, prompt_tokens bigint, completion_tokens bigint, input_spend_usd numeric, output_spend_usd numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(gm.canonical_model, public.normalise_model_id(s.model)), s.hour::date,
    sum(s.requests)::bigint, sum(s.prompt_tokens)::bigint, sum(s.completion_tokens)::bigint,
    sum(s.input_spend_usd + s.cached_spend_usd), sum(s.output_spend_usd)
  FROM public.customer_garage_model_stats_hourly s
  JOIN public.garages g ON g.id = s.garage_id AND g.visibility = 'market' AND NOT g.disabled
  LEFT JOIN public.garage_models gm ON gm.garage_id = s.garage_id AND regexp_replace(gm.model,'[^A-Za-z0-9._-]','-','g') = s.model
  WHERE s.hour >= now() - interval '30 days' AND coalesce(gm.private, false) = false
  GROUP BY 1, 2
$$;

CREATE OR REPLACE FUNCTION public.garage_public_supply()
RETURNS TABLE(garage_name text, is_endpoint boolean, terms_accepted boolean, forwards_to text, tokens_1d bigint, tokens_30d bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT g.name, g.connection_type = 'endpoint', g.terms_accepted_at IS NOT NULL,
    CASE WHEN g.connection_type = 'endpoint' AND g.endpoint_url ILIKE '%openrouter.ai%' THEN 'OpenRouter' END,
    coalesce((SELECT sum(h.prompt_tokens + h.completion_tokens) FROM public.customer_garage_request_stats_hourly h WHERE h.garage_id = g.id AND h.hour >= now() - interval '1 day'), 0)::bigint,
    coalesce((SELECT sum(h.prompt_tokens + h.completion_tokens) FROM public.customer_garage_request_stats_hourly h WHERE h.garage_id = g.id AND h.hour >= now() - interval '30 days'), 0)::bigint
  FROM public.garages g WHERE NOT g.disabled AND g.visibility = 'market'
$$;

REVOKE ALL ON FUNCTION public.model_public_daily() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.garage_public_supply() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.model_public_daily() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.garage_public_supply() TO anon, authenticated, service_role;