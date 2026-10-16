ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS internal boolean NOT NULL DEFAULT false;
UPDATE public.api_keys SET internal=true WHERE name ~* '^(test|probe|ops)';
CREATE OR REPLACE FUNCTION public.guard_api_key_internal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF TG_OP='INSERT' AND NEW.internal AND NEW.name !~* '^(test|probe|ops)' AND auth.role() IS DISTINCT FROM 'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins may classify internal keys'; END IF;
IF TG_OP='UPDATE' AND NEW.internal IS DISTINCT FROM OLD.internal AND auth.role() IS DISTINCT FROM 'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins may change internal traffic classification'; END IF;
IF NEW.name ~* '^(test|probe|ops)' THEN NEW.internal:=true; END IF; RETURN NEW; END $$;
CREATE TRIGGER guard_api_key_internal BEFORE INSERT OR UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.guard_api_key_internal();
CREATE TABLE public.gateway_key_records (fingerprint text PRIMARY KEY, alias text, internal boolean NOT NULL DEFAULT false, checked_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.gateway_key_records TO authenticated; GRANT ALL ON public.gateway_key_records TO service_role;
ALTER TABLE public.gateway_key_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY gateway_key_records_admin ON public.gateway_key_records FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.customer_garage_request_stats_hourly (LIKE public.garage_request_stats_hourly INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
GRANT ALL ON public.customer_garage_request_stats_hourly TO service_role;
ALTER TABLE public.customer_garage_request_stats_hourly ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.customer_garage_model_stats_hourly (LIKE public.garage_model_stats_hourly INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
GRANT ALL ON public.customer_garage_model_stats_hourly TO service_role;
ALTER TABLE public.customer_garage_model_stats_hourly ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.internal_model_stats_hourly (garage_id uuid NOT NULL,model text NOT NULL,hour timestamptz NOT NULL,requests bigint NOT NULL DEFAULT 0,tokens bigint NOT NULL DEFAULT 0,spend_usd numeric NOT NULL DEFAULT 0,PRIMARY KEY(garage_id,model,hour));
GRANT SELECT ON public.internal_model_stats_hourly TO authenticated; GRANT ALL ON public.internal_model_stats_hourly TO service_role;
ALTER TABLE public.internal_model_stats_hourly ENABLE ROW LEVEL SECURITY;
CREATE POLICY internal_stats_admin ON public.internal_model_stats_hourly FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
DO $$ DECLARE r record; definition text; BEGIN
FOR r IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('model_demand','smart_model_demand','operator_garage_overview','operator_garage_activity','garage_public_stats','garage_daily_tokens') LOOP
 definition:=pg_get_functiondef(r.oid);
 definition:=replace(replace(definition,'garage_model_stats_hourly','customer_garage_model_stats_hourly'),'garage_request_stats_hourly','customer_garage_request_stats_hourly');
 EXECUTE definition;
END LOOP; END $$;
COMMENT ON TABLE public.customer_garage_model_stats_hourly IS 'Customer-only aggregates; never copy mixed historical hourly buckets. Rebuilt from classified gateway logs.';
COMMENT ON TABLE public.internal_model_stats_hourly IS 'Test, probe, acceptance and gateway traffic; Admin-only access.';