ALTER TABLE public.garage_model_stats_hourly ADD COLUMN IF NOT EXISTS api_keys text[] NOT NULL DEFAULT '{}';
DROP FUNCTION IF EXISTS public.smart_model_demand();
CREATE FUNCTION public.smart_model_demand() RETURNS TABLE(model text,requests_7d bigint,requests_14d bigint,healthy_garages bigint,distinct_keys_7d bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH rows AS(SELECT coalesce(gm.canonical_model,public.normalise_model_id(s.model)) model,s.hour,s.requests,s.api_keys FROM garage_model_stats_hourly s LEFT JOIN garage_models gm ON gm.garage_id=s.garage_id AND s.model=regexp_replace(gm.model,'[^A-Za-z0-9._-]','-','g') WHERE s.hour>=now()-interval '14 days'),
demand AS(SELECT model,sum(requests) FILTER(WHERE hour>=now()-interval '7 days')::bigint r7,sum(requests)::bigint r14 FROM rows GROUP BY 1),
keys AS(SELECT model,count(DISTINCT k)::bigint n FROM rows,unnest(api_keys) k WHERE hour>=now()-interval '7 days' GROUP BY 1),
healthy AS(SELECT c.model_name model,count(DISTINCT c.garage)::bigint n FROM curated_models c JOIN garages g ON g.name=c.garage WHERE c.enabled AND c.status='healthy' AND c.garage_tier='pool' AND NOT g.disabled AND g.paused_at IS NULL AND g.runtime_ok=true AND g.mesh_connected IS DISTINCT FROM false AND g.last_gateway_check_at>=now()-interval '15 minutes' GROUP BY c.model_name)
SELECT d.model,coalesce(d.r7,0),coalesce(d.r14,0),coalesce(h.n,0),coalesce(k.n,0) FROM demand d LEFT JOIN healthy h ON h.model=d.model LEFT JOIN keys k ON k.model=d.model $$;
REVOKE ALL ON FUNCTION public.smart_model_demand() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.smart_model_demand() TO service_role;