ALTER TABLE public.curated_models ADD COLUMN IF NOT EXISTS ollama_tag text;
ALTER TABLE public.garages ADD COLUMN IF NOT EXISTS first_models_at timestamptz, ADD COLUMN IF NOT EXISTS offer_page_seen_at timestamptz;

UPDATE public.curated_models c SET ollama_tag = (
  SELECT gm.model FROM public.garage_models gm JOIN public.garages g ON g.id = gm.garage_id
  WHERE g.runtime = 'ollama' AND gm.canonical_model = c.model_name ORDER BY gm.model LIMIT 1)
WHERE c.ollama_tag IS NULL;
UPDATE public.garages SET first_models_at = coalesce(last_registered_at, created_at), offer_page_seen_at = now()
WHERE first_models_at IS NULL AND cardinality(models) > 0;

CREATE TABLE public.garage_managed_models (
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  model text NOT NULL,
  action text NOT NULL CHECK (action IN ('pull','remove')),
  "by" text NOT NULL CHECK ("by" IN ('operator','garageai')),
  status text NOT NULL DEFAULT 'wanted' CHECK (status IN ('wanted','downloading','ready','failed','removed','refused')),
  completed_mb numeric, total_mb numeric, error text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reported_at timestamptz,
  PRIMARY KEY (garage_id, model)
);
GRANT SELECT ON public.garage_managed_models TO authenticated;
GRANT ALL ON public.garage_managed_models TO service_role;
ALTER TABLE public.garage_managed_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators read own managed models" ON public.garage_managed_models FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.garages g WHERE g.id = garage_id AND g.operator_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.request_managed_model(_garage_id uuid, _model text, _action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; cur record;
BEGIN
  SELECT * INTO g FROM garages WHERE id = _garage_id;
  IF g IS NULL OR NOT (g.operator_id = auth.uid() OR has_role(auth.uid(), 'admin')) THEN RAISE EXCEPTION 'not your garage'; END IF;
  IF g.runtime IS DISTINCT FROM 'ollama' THEN RAISE EXCEPTION 'fetching models is available for Ollama'; END IF;
  IF _model IS NULL OR length(_model) > 200 OR _model !~ '^[A-Za-z0-9._:/-]+$' THEN RAISE EXCEPTION 'invalid model'; END IF;
  SELECT * INTO cur FROM garage_managed_models WHERE garage_id = _garage_id AND model = _model;
  IF _action = 'pull' THEN
    INSERT INTO garage_managed_models (garage_id, model, action, "by", status, requested_at)
    VALUES (_garage_id, _model, 'pull', 'operator', 'wanted', now())
    ON CONFLICT (garage_id, model) DO UPDATE SET action = 'pull', "by" = 'operator', status = 'wanted', completed_mb = NULL, total_mb = NULL, error = NULL, requested_at = now(), reported_at = NULL;
  ELSIF _action = 'remove' THEN
    IF cur IS NULL OR cur.action <> 'pull' OR cur.status <> 'ready' THEN RAISE EXCEPTION 'only models Bridge fetched can be removed'; END IF;
    UPDATE garage_managed_models SET action = 'remove', status = 'wanted', error = NULL, requested_at = now(), reported_at = NULL WHERE garage_id = _garage_id AND model = _model;
  ELSE RAISE EXCEPTION 'invalid action'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_managed_model(_garage_id uuid, _model text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM garages WHERE id = _garage_id AND (operator_id = auth.uid() OR has_role(auth.uid(), 'admin'))) THEN RAISE EXCEPTION 'not your garage'; END IF;
  -- Cancelled remove: the model stays managed and ready. Cancelled pull: the entry goes away.
  UPDATE garage_managed_models SET action = 'pull', status = 'ready', error = NULL WHERE garage_id = _garage_id AND model = _model AND action = 'remove' AND status <> 'removed';
  DELETE FROM garage_managed_models WHERE garage_id = _garage_id AND model = _model AND action = 'pull' AND status <> 'ready';
END $$;

CREATE OR REPLACE FUNCTION public.mark_offer_page_seen(_garage_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE garages SET offer_page_seen_at = now() WHERE id = _garage_id AND operator_id = auth.uid() AND offer_page_seen_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.model_demand()
RETURNS TABLE(model text, requests_7d bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT gm.canonical_model, sum(s.requests)::bigint
  FROM garage_model_stats_hourly s JOIN garage_models gm ON gm.garage_id = s.garage_id AND regexp_replace(gm.model, '[^A-Za-z0-9._-]', '-', 'g') = s.model
  WHERE s.hour > now() - interval '7 days' GROUP BY 1;
$$;

REVOKE EXECUTE ON FUNCTION public.request_managed_model(uuid, text, text), public.cancel_managed_model(uuid, text), public.mark_offer_page_seen(uuid), public.model_demand() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_managed_model(uuid, text, text), public.cancel_managed_model(uuid, text), public.mark_offer_page_seen(uuid), public.model_demand() TO authenticated;