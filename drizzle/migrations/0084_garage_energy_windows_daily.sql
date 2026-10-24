CREATE TABLE public.garage_energy_windows (
 garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
 at timestamptz NOT NULL DEFAULT now(), window_min integer, source text, wh numeric, busy_wh numeric,
 out_tokens bigint, in_tokens bigint, models jsonb NOT NULL DEFAULT '[]'::jsonb,
 PRIMARY KEY (garage_id, at),
 CHECK (window_min BETWEEN 1 AND 60), CHECK (source IN ('nvidia-smi','powermetrics')),
 CHECK (wh BETWEEN 0 AND 5000), CHECK (busy_wh BETWEEN 0 AND 5000),
 CHECK (out_tokens BETWEEN 0 AND 1000000000), CHECK (in_tokens BETWEEN 0 AND 1000000000),
 CHECK (jsonb_typeof(models)='array' AND jsonb_array_length(models)<=50)
);
GRANT SELECT ON public.garage_energy_windows TO authenticated;
GRANT ALL ON public.garage_energy_windows TO service_role;
ALTER TABLE public.garage_energy_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY energy_windows_read ON public.garage_energy_windows FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.garages g WHERE g.id=garage_id AND g.operator_id=auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE INDEX garage_energy_windows_at_idx ON public.garage_energy_windows(at);
CREATE TABLE public.garage_energy_daily (
 garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
 model text NOT NULL DEFAULT '', day date NOT NULL, source text NOT NULL DEFAULT '',
 busy_wh numeric, wh numeric, out_tokens bigint, in_tokens bigint,
 efficiency_wh numeric NOT NULL DEFAULT 0, efficiency_tokens bigint NOT NULL DEFAULT 0,
 tokens_per_kwh numeric GENERATED ALWAYS AS (efficiency_tokens / nullif(efficiency_wh / 1000,0)) STORED,
 PRIMARY KEY (garage_id,model,day,source)
);
GRANT SELECT ON public.garage_energy_daily TO authenticated;
GRANT ALL ON public.garage_energy_daily TO service_role;
ALTER TABLE public.garage_energy_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY energy_daily_read ON public.garage_energy_daily FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.garages g WHERE g.id=garage_id AND g.operator_id=auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE INDEX garage_energy_daily_day_idx ON public.garage_energy_daily(day);
CREATE FUNCTION public.aggregate_garage_energy() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; d date := (NEW.at AT TIME ZONE 'UTC')::date; s text := coalesce(NEW.source,'');
BEGIN
 INSERT INTO public.garage_energy_daily(garage_id,model,day,source,wh,busy_wh,out_tokens,in_tokens,efficiency_wh,efficiency_tokens)
 VALUES(NEW.garage_id,'',d,s,NEW.wh,NEW.busy_wh,NEW.out_tokens,NEW.in_tokens,
 CASE WHEN NEW.out_tokens IS NOT NULL AND NEW.busy_wh>0 THEN NEW.busy_wh ELSE 0 END,
 CASE WHEN NEW.out_tokens IS NOT NULL AND NEW.busy_wh>0 THEN NEW.out_tokens ELSE 0 END)
 ON CONFLICT(garage_id,model,day,source) DO UPDATE SET
 wh=CASE WHEN EXCLUDED.wh IS NULL THEN garage_energy_daily.wh ELSE coalesce(garage_energy_daily.wh,0)+EXCLUDED.wh END,
 busy_wh=CASE WHEN EXCLUDED.busy_wh IS NULL THEN garage_energy_daily.busy_wh ELSE coalesce(garage_energy_daily.busy_wh,0)+EXCLUDED.busy_wh END,
 out_tokens=CASE WHEN EXCLUDED.out_tokens IS NULL THEN garage_energy_daily.out_tokens ELSE coalesce(garage_energy_daily.out_tokens,0)+EXCLUDED.out_tokens END,
 in_tokens=CASE WHEN EXCLUDED.in_tokens IS NULL THEN garage_energy_daily.in_tokens ELSE coalesce(garage_energy_daily.in_tokens,0)+EXCLUDED.in_tokens END,
 efficiency_wh=garage_energy_daily.efficiency_wh+EXCLUDED.efficiency_wh,
 efficiency_tokens=garage_energy_daily.efficiency_tokens+EXCLUDED.efficiency_tokens;
 FOR item IN SELECT value FROM jsonb_array_elements(NEW.models) LOOP
 INSERT INTO public.garage_energy_daily(garage_id,model,day,source,busy_wh,out_tokens,efficiency_wh,efficiency_tokens)
 VALUES(NEW.garage_id,item->>'model',d,s,(item->>'busy_wh')::numeric,(item->>'out_tokens')::bigint,
 CASE WHEN item->>'out_tokens' IS NOT NULL AND (item->>'busy_wh')::numeric>0 THEN (item->>'busy_wh')::numeric ELSE 0 END,
 CASE WHEN item->>'out_tokens' IS NOT NULL AND (item->>'busy_wh')::numeric>0 THEN (item->>'out_tokens')::bigint ELSE 0 END)
 ON CONFLICT(garage_id,model,day,source) DO UPDATE SET
 busy_wh=CASE WHEN EXCLUDED.busy_wh IS NULL THEN garage_energy_daily.busy_wh ELSE coalesce(garage_energy_daily.busy_wh,0)+EXCLUDED.busy_wh END,
 out_tokens=CASE WHEN EXCLUDED.out_tokens IS NULL THEN garage_energy_daily.out_tokens ELSE coalesce(garage_energy_daily.out_tokens,0)+EXCLUDED.out_tokens END,
 efficiency_wh=garage_energy_daily.efficiency_wh+EXCLUDED.efficiency_wh,
 efficiency_tokens=garage_energy_daily.efficiency_tokens+EXCLUDED.efficiency_tokens;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.aggregate_garage_energy() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER garage_energy_window_aggregate AFTER INSERT ON public.garage_energy_windows FOR EACH ROW EXECUTE FUNCTION public.aggregate_garage_energy();
CREATE FUNCTION public.garage_energy_summary(_garage_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH allowed AS (SELECT id FROM public.garages WHERE id=_garage_id AND (operator_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR auth.role()='service_role')),
 today AS (SELECT sum(wh) wh,sum(busy_wh) busy_wh,sum(efficiency_tokens)/nullif(sum(efficiency_wh)/1000,0) tokens_per_kwh,array_agg(DISTINCT nullif(source,'')) sources FROM public.garage_energy_daily WHERE garage_id IN (SELECT id FROM allowed) AND model='' AND day=(now() AT TIME ZONE 'UTC')::date),
 models AS (SELECT d.model,coalesce(gm.canonical_model,public.normalise_model_id(d.model)) canonical_model,sum(d.efficiency_tokens)/nullif(sum(d.efficiency_wh)/1000,0) tokens_per_kwh FROM public.garage_energy_daily d LEFT JOIN public.garage_models gm ON gm.garage_id=d.garage_id AND gm.model=d.model WHERE d.garage_id IN (SELECT id FROM allowed) AND d.model<>'' AND d.day BETWEEN (now() AT TIME ZONE 'UTC')::date-6 AND (now() AT TIME ZONE 'UTC')::date GROUP BY d.model,gm.canonical_model)
 SELECT CASE WHEN EXISTS(SELECT 1 FROM allowed) THEN jsonb_build_object('today',(SELECT to_jsonb(today) FROM today),'models',coalesce((SELECT jsonb_agg(to_jsonb(models)) FROM models),'[]'::jsonb)) ELSE NULL END
$$;
REVOKE ALL ON FUNCTION public.garage_energy_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.garage_energy_summary(uuid) TO authenticated,service_role;
CREATE FUNCTION public.garage_public_energy(_model text) RETURNS TABLE(garage_name text,tokens_per_kwh numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT g.name,sum(d.efficiency_tokens)/nullif(sum(d.efficiency_wh)/1000,0)
 FROM public.garage_energy_daily d JOIN public.garages g ON g.id=d.garage_id JOIN public.garage_models gm ON gm.garage_id=d.garage_id AND gm.model=d.model
 WHERE d.model<>'' AND gm.canonical_model=_model AND gm.offered AND gm.installed AND gm.status='live' AND NOT gm.private
 AND g.visibility='market' AND NOT g.disabled AND g.connection_type<>'endpoint'
 AND EXISTS(SELECT 1 FROM public.curated_models c WHERE c.enabled AND (c.model_name=_model OR c.id=_model))
 AND d.day BETWEEN (now() AT TIME ZONE 'UTC')::date-6 AND (now() AT TIME ZONE 'UTC')::date GROUP BY g.name;
$$;
REVOKE ALL ON FUNCTION public.garage_public_energy(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.garage_public_energy(text) TO anon,authenticated,service_role;
CREATE FUNCTION public.prune_garage_energy() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE removed bigint;
BEGIN
 DELETE FROM public.garage_energy_windows WHERE at<now()-interval '90 days'; GET DIAGNOSTICS removed=ROW_COUNT;
 DELETE FROM public.garage_energy_daily WHERE day<(now() AT TIME ZONE 'UTC')::date-90;
 RETURN removed;
END $$;
REVOKE ALL ON FUNCTION public.prune_garage_energy() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prune_garage_energy() TO service_role;