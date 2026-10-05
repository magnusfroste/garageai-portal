ALTER TABLE public.garages ADD COLUMN IF NOT EXISTS connection_type text NOT NULL DEFAULT 'mesh';
ALTER TABLE public.garages ADD CONSTRAINT garages_connection_type_check CHECK (connection_type IN ('mesh','endpoint'));
ALTER TABLE public.garages ADD COLUMN IF NOT EXISTS endpoint_url text;
ALTER TABLE public.garages ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.garage_request_stats_hourly ADD COLUMN IF NOT EXISTS prompt_tokens bigint NOT NULL DEFAULT 0;
ALTER TABLE public.garage_request_stats_hourly ADD COLUMN IF NOT EXISTS spend_usd numeric NOT NULL DEFAULT 0;

CREATE TABLE public.garage_model_stats_hourly (
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  model text NOT NULL,
  hour timestamptz NOT NULL,
  requests integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  prompt_tokens bigint NOT NULL DEFAULT 0,
  completion_tokens bigint NOT NULL DEFAULT 0,
  spend_usd numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (garage_id, model, hour)
);
GRANT ALL ON public.garage_model_stats_hourly TO service_role;
ALTER TABLE public.garage_model_stats_hourly ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.garage_revenue(_from timestamptz, _to timestamptz)
RETURNS TABLE(garage_name text, display_name text, connection_type text, model text, requests bigint, failures bigint, prompt_tokens bigint, completion_tokens bigint, spend_usd numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT g.name, g.display_name, g.connection_type, s.model,
    sum(s.requests)::bigint, sum(s.failures)::bigint, sum(s.prompt_tokens)::bigint, sum(s.completion_tokens)::bigint, coalesce(sum(s.spend_usd), 0)
  FROM public.garage_model_stats_hourly s JOIN public.garages g ON g.id = s.garage_id
  WHERE public.has_role(auth.uid(), 'admin') AND s.hour >= _from AND s.hour < _to
  GROUP BY g.name, g.display_name, g.connection_type, s.model
$$;
REVOKE EXECUTE ON FUNCTION public.garage_revenue(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garage_revenue(timestamptz, timestamptz) TO authenticated;