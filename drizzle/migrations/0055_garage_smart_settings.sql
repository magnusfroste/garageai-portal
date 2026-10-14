ALTER TABLE public.garages ADD COLUMN smart boolean NOT NULL DEFAULT false;
ALTER TABLE public.garages ALTER COLUMN smart SET DEFAULT true;
ALTER TABLE public.garages ADD COLUMN smart_disk_gb numeric NOT NULL DEFAULT 40 CHECK(smart_disk_gb>0 AND smart_disk_gb<=100000);
ALTER TABLE public.garage_models ADD COLUMN pool_input_cost_per_million numeric CHECK(pool_input_cost_per_million>=0), ADD COLUMN pool_output_cost_per_million numeric CHECK(pool_output_cost_per_million>=0), ADD COLUMN dedicated_input_cost_per_million numeric CHECK(dedicated_input_cost_per_million>=0), ADD COLUMN dedicated_output_cost_per_million numeric CHECK(dedicated_output_cost_per_million>=0);
CREATE TABLE public.garage_smart_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,operator_id uuid NOT NULL REFERENCES public.profiles(id),day date NOT NULL DEFAULT(now() AT TIME ZONE 'UTC')::date,model text NOT NULL,action text NOT NULL CHECK(action IN('pull','remove')),reason jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),email_sent_at timestamptz,UNIQUE(garage_id,day));
GRANT SELECT ON public.garage_smart_events TO authenticated;
GRANT ALL ON public.garage_smart_events TO service_role;
ALTER TABLE public.garage_smart_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators read Smart notices" ON public.garage_smart_events FOR SELECT TO authenticated USING(operator_id=auth.uid());
CREATE OR REPLACE FUNCTION public.set_garage_smart(_garage_id uuid,_smart boolean,_disk_gb numeric DEFAULT 40) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM garages WHERE id=_garage_id AND operator_id=auth.uid()) THEN RAISE EXCEPTION 'Not your garage'; END IF;
IF _smart IS NULL OR _disk_gb IS NULL OR _disk_gb<=0 OR _disk_gb>100000 THEN RAISE EXCEPTION 'Invalid disk budget'; END IF;
UPDATE garages SET smart=_smart,smart_disk_gb=_disk_gb WHERE id=_garage_id; END $$;
REVOKE ALL ON FUNCTION public.set_garage_smart(uuid,boolean,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_garage_smart(uuid,boolean,numeric) TO authenticated;
CREATE OR REPLACE FUNCTION public.smart_model_demand() RETURNS TABLE(model text,requests_7d bigint,requests_14d bigint,healthy_garages bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH demand AS(SELECT coalesce(gm.canonical_model,public.normalise_model_id(s.model)) model,sum(s.requests) FILTER(WHERE s.hour>=now()-interval '7 days')::bigint r7,sum(s.requests)::bigint r14 FROM garage_model_stats_hourly s LEFT JOIN garage_models gm ON gm.garage_id=s.garage_id AND s.model=regexp_replace(gm.model,'[^A-Za-z0-9._-]','-','g') WHERE s.hour>=now()-interval '14 days' GROUP BY 1), healthy AS(SELECT c.model_name model,count(DISTINCT c.garage)::bigint n FROM curated_models c JOIN garages g ON g.name=c.garage WHERE c.enabled AND c.status='healthy' AND c.garage_tier='pool' AND NOT g.disabled AND g.paused_at IS NULL AND g.runtime_ok=true AND g.mesh_connected IS DISTINCT FROM false AND g.last_gateway_check_at>=now()-interval '15 minutes' GROUP BY c.model_name)
SELECT d.model,coalesce(d.r7,0),coalesce(d.r14,0),coalesce(h.n,0) FROM demand d LEFT JOIN healthy h ON h.model=d.model $$;
REVOKE ALL ON FUNCTION public.smart_model_demand() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.smart_model_demand() TO service_role;