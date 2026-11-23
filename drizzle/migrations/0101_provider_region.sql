ALTER TABLE public.garages
  ADD COLUMN IF NOT EXISTS provider_region text CHECK (provider_region IN ('se','eu','other')),
  ADD COLUMN IF NOT EXISTS provider_region_by uuid,
  ADD COLUMN IF NOT EXISTS provider_region_at timestamptz;

CREATE TABLE public.garage_region_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  region text CHECK (region IN ('se','eu','other')),
  previous_region text,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.garage_region_events TO authenticated;
GRANT ALL ON public.garage_region_events TO service_role;
ALTER TABLE public.garage_region_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read region events" ON public.garage_region_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

UPDATE public.garages SET provider_region = 'se', provider_region_at = now() WHERE connection_type = 'endpoint' AND name IN ('autoversio','autoversio-south') AND provider_region IS NULL;
UPDATE public.garages SET provider_region = 'other', provider_region_at = now() WHERE connection_type = 'endpoint' AND name = 'city-garaget' AND provider_region IS NULL;

DROP FUNCTION IF EXISTS public.garage_public_supply();
CREATE FUNCTION public.garage_public_supply()
RETURNS TABLE(garage_name text, is_endpoint boolean, terms_accepted boolean, forwards_to text, tokens_1d bigint, tokens_30d bigint, provider_region text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT g.name, g.connection_type = 'endpoint', g.terms_accepted_at IS NOT NULL,
    CASE WHEN g.connection_type = 'endpoint' AND g.endpoint_url ILIKE '%openrouter.ai%' THEN 'OpenRouter' END,
    coalesce((SELECT sum(h.prompt_tokens + h.completion_tokens) FROM public.customer_garage_request_stats_hourly h WHERE h.garage_id = g.id AND h.hour >= now() - interval '1 day'), 0)::bigint,
    coalesce((SELECT sum(h.prompt_tokens + h.completion_tokens) FROM public.customer_garage_request_stats_hourly h WHERE h.garage_id = g.id AND h.hour >= now() - interval '30 days'), 0)::bigint,
    CASE WHEN g.connection_type = 'endpoint' THEN g.provider_region END
  FROM public.garages g WHERE NOT g.disabled AND g.visibility = 'market'
$$;
REVOKE ALL ON FUNCTION public.garage_public_supply() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.garage_public_supply() TO anon, authenticated, service_role;