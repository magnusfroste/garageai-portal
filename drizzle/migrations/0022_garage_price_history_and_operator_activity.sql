CREATE TABLE public.garage_price_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 garage_id uuid NOT NULL REFERENCES public.garages(id),
 prices jsonb NOT NULL,
 effective_from timestamptz NOT NULL DEFAULT now(),
 changed_by uuid
);
GRANT SELECT ON public.garage_price_history TO authenticated;
GRANT ALL ON public.garage_price_history TO service_role;
ALTER TABLE public.garage_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read price history" ON public.garage_price_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.garage_price_history (garage_id, prices, effective_from)
SELECT id, jsonb_build_object('pool_input_cost_per_million',pool_input_cost_per_million,'pool_output_cost_per_million',pool_output_cost_per_million,'dedicated_input_cost_per_million',dedicated_input_cost_per_million,'dedicated_output_cost_per_million',dedicated_output_cost_per_million), now() FROM public.garages;
CREATE FUNCTION public.record_garage_prices() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP = 'INSERT' OR (NEW.pool_input_cost_per_million,NEW.pool_output_cost_per_million,NEW.dedicated_input_cost_per_million,NEW.dedicated_output_cost_per_million) IS DISTINCT FROM (OLD.pool_input_cost_per_million,OLD.pool_output_cost_per_million,OLD.dedicated_input_cost_per_million,OLD.dedicated_output_cost_per_million) THEN
 INSERT INTO public.garage_price_history(garage_id,prices,changed_by) VALUES(NEW.id,jsonb_build_object('pool_input_cost_per_million',NEW.pool_input_cost_per_million,'pool_output_cost_per_million',NEW.pool_output_cost_per_million,'dedicated_input_cost_per_million',NEW.dedicated_input_cost_per_million,'dedicated_output_cost_per_million',NEW.dedicated_output_cost_per_million),auth.uid());
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER record_garage_prices AFTER INSERT OR UPDATE ON public.garages FOR EACH ROW EXECUTE FUNCTION public.record_garage_prices();
CREATE FUNCTION public.operator_garage_activity() RETURNS TABLE(garage_id uuid,period text,requests bigint,prompt_tokens bigint,completion_tokens bigint,recorded_spend numeric,estimated_earnings numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT g.id,w.period,coalesce(sum(s.requests),0)::bigint,coalesce(sum(s.prompt_tokens),0)::bigint,coalesce(sum(s.completion_tokens),0)::bigint,coalesce(sum(s.spend_usd),0),coalesce(sum((s.prompt_tokens * CASE WHEN s.model LIKE 'garage/%' THEN g.dedicated_input_cost_per_million ELSE g.pool_input_cost_per_million END + s.completion_tokens * CASE WHEN s.model LIKE 'garage/%' THEN g.dedicated_output_cost_per_million ELSE g.pool_output_cost_per_million END)/1000000),0)
 FROM public.garages g CROSS JOIN (VALUES('7d',interval '7 days'),('30d',interval '30 days')) w(period,span)
 LEFT JOIN public.garage_model_stats_hourly s ON s.garage_id=g.id AND s.hour>=now()-w.span
 WHERE g.operator_id=auth.uid() OR public.has_role(auth.uid(),'admin') GROUP BY g.id,w.period
$$;
REVOKE ALL ON FUNCTION public.operator_garage_activity() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.operator_garage_activity() TO authenticated,service_role;