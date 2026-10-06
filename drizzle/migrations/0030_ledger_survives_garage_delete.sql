ALTER TABLE public.garage_request_stats_hourly ADD COLUMN IF NOT EXISTS garage_name text;
ALTER TABLE public.garage_model_stats_hourly ADD COLUMN IF NOT EXISTS garage_name text;
ALTER TABLE public.garage_price_history ADD COLUMN IF NOT EXISTS garage_name text;
UPDATE public.garage_request_stats_hourly s SET garage_name = g.name FROM public.garages g WHERE g.id = s.garage_id AND s.garage_name IS NULL;
UPDATE public.garage_model_stats_hourly s SET garage_name = g.name FROM public.garages g WHERE g.id = s.garage_id AND s.garage_name IS NULL;
UPDATE public.garage_price_history s SET garage_name = g.name FROM public.garages g WHERE g.id = s.garage_id AND s.garage_name IS NULL;

CREATE OR REPLACE FUNCTION public.fill_ledger_garage_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.garage_name IS NULL THEN SELECT name INTO NEW.garage_name FROM public.garages WHERE id = NEW.garage_id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fill_garage_name BEFORE INSERT ON public.garage_request_stats_hourly FOR EACH ROW EXECUTE FUNCTION public.fill_ledger_garage_name();
CREATE TRIGGER fill_garage_name BEFORE INSERT ON public.garage_model_stats_hourly FOR EACH ROW EXECUTE FUNCTION public.fill_ledger_garage_name();
CREATE TRIGGER fill_garage_name BEFORE INSERT ON public.garage_price_history FOR EACH ROW EXECUTE FUNCTION public.fill_ledger_garage_name();

-- Ledger rows outlive the garage: garage_id stays as a plain historical id.
ALTER TABLE public.garage_request_stats_hourly DROP CONSTRAINT IF EXISTS garage_request_stats_hourly_garage_id_fkey;
ALTER TABLE public.garage_model_stats_hourly DROP CONSTRAINT IF EXISTS garage_model_stats_hourly_garage_id_fkey;
ALTER TABLE public.garage_price_history DROP CONSTRAINT IF EXISTS garage_price_history_garage_id_fkey;

CREATE OR REPLACE FUNCTION public.garage_revenue(_from timestamp with time zone, _to timestamp with time zone)
 RETURNS TABLE(garage_name text, display_name text, connection_type text, model text, requests bigint, failures bigint, prompt_tokens bigint, completion_tokens bigint, spend_usd numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(g.name, s.garage_name, s.garage_id::text), coalesce(g.display_name, s.garage_name || ' (deleted)'), coalesce(g.connection_type, 'deleted'), s.model,
    sum(s.requests)::bigint, sum(s.failures)::bigint, sum(s.prompt_tokens)::bigint, sum(s.completion_tokens)::bigint, coalesce(sum(s.spend_usd), 0)
  FROM public.garage_model_stats_hourly s LEFT JOIN public.garages g ON g.id = s.garage_id
  WHERE public.has_role(auth.uid(), 'admin') AND s.hour >= _from AND s.hour < _to
  GROUP BY 1, 2, 3, s.model
$function$;