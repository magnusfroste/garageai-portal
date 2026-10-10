ALTER TABLE public.garages
  ADD COLUMN pool_cache_read_cost_per_million numeric CHECK (pool_cache_read_cost_per_million >= 0),
  ADD COLUMN dedicated_cache_read_cost_per_million numeric CHECK (dedicated_cache_read_cost_per_million >= 0);
ALTER TABLE public.garage_models
  ADD COLUMN pool_cache_read_cost_per_million numeric CHECK (pool_cache_read_cost_per_million >= 0),
  ADD COLUMN dedicated_cache_read_cost_per_million numeric CHECK (dedicated_cache_read_cost_per_million >= 0);
ALTER TABLE public.curated_models ADD COLUMN cache_read_cost_per_million numeric;
ALTER TABLE public.garage_model_stats_hourly
  ADD COLUMN cached_prompt_tokens bigint NOT NULL DEFAULT 0,
  ADD COLUMN input_spend_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN cached_spend_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN output_spend_usd numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.record_garage_prices() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP = 'INSERT' OR (NEW.pool_input_cost_per_million,NEW.pool_output_cost_per_million,NEW.dedicated_input_cost_per_million,NEW.dedicated_output_cost_per_million,NEW.pool_cache_read_cost_per_million,NEW.dedicated_cache_read_cost_per_million) IS DISTINCT FROM (OLD.pool_input_cost_per_million,OLD.pool_output_cost_per_million,OLD.dedicated_input_cost_per_million,OLD.dedicated_output_cost_per_million,OLD.pool_cache_read_cost_per_million,OLD.dedicated_cache_read_cost_per_million) THEN
 INSERT INTO public.garage_price_history(garage_id,prices,changed_by) VALUES(NEW.id,jsonb_build_object('pool_input_cost_per_million',NEW.pool_input_cost_per_million,'pool_output_cost_per_million',NEW.pool_output_cost_per_million,'dedicated_input_cost_per_million',NEW.dedicated_input_cost_per_million,'dedicated_output_cost_per_million',NEW.dedicated_output_cost_per_million,'pool_cache_read_cost_per_million',NEW.pool_cache_read_cost_per_million,'dedicated_cache_read_cost_per_million',NEW.dedicated_cache_read_cost_per_million),auth.uid());
 END IF; RETURN NEW;
END $$;

DROP FUNCTION IF EXISTS public.garage_revenue(timestamptz, timestamptz);
CREATE FUNCTION public.garage_revenue(_from timestamptz, _to timestamptz)
 RETURNS TABLE(garage_name text, display_name text, connection_type text, model text, runtime_models text[], requests bigint, failures bigint, prompt_tokens bigint, completion_tokens bigint, spend_usd numeric, cached_prompt_tokens bigint, input_spend_usd numeric, cached_spend_usd numeric, output_spend_usd numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(g.name, s.garage_name, s.garage_id::text), coalesce(g.display_name, s.garage_name || ' (deleted)'), coalesce(g.connection_type, 'deleted'),
    coalesce(gm.canonical_model, s.model),
    array_agg(DISTINCT s.model ORDER BY s.model),
    sum(s.requests)::bigint, sum(s.failures)::bigint, sum(s.prompt_tokens)::bigint, sum(s.completion_tokens)::bigint, coalesce(sum(s.spend_usd), 0),
    coalesce(sum(s.cached_prompt_tokens), 0)::bigint, coalesce(sum(s.input_spend_usd), 0), coalesce(sum(s.cached_spend_usd), 0), coalesce(sum(s.output_spend_usd), 0)
  FROM public.garage_model_stats_hourly s
  LEFT JOIN public.garages g ON g.id = s.garage_id
  LEFT JOIN public.garage_models gm ON gm.garage_id = s.garage_id AND gm.model = s.model
  WHERE public.has_role(auth.uid(), 'admin') AND s.hour >= _from AND s.hour < _to
  GROUP BY 1, 2, 3, 4
$function$;
REVOKE ALL ON FUNCTION public.garage_revenue(timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.garage_revenue(timestamptz, timestamptz) TO authenticated, service_role;