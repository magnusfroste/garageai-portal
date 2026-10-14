ALTER TABLE public.garage_managed_models DROP CONSTRAINT garage_managed_models_by_check;
ALTER TABLE public.garage_managed_models ADD CONSTRAINT garage_managed_models_by_check CHECK ("by" = ANY (ARRAY['operator','garageai','ops-test']));

-- Shared write path for Add/Remove and Cancel; callers do their own authorization.
CREATE OR REPLACE FUNCTION public.apply_managed_model_request(_garage_id uuid, _model text, _action text, _by text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g record; cur record;
BEGIN
  SELECT * INTO g FROM garages WHERE id = _garage_id;
  IF g IS NULL THEN RAISE EXCEPTION 'garage not found'; END IF;
  IF g.runtime IS DISTINCT FROM 'ollama' THEN RAISE EXCEPTION 'fetching models is available for Ollama'; END IF;
  IF _model IS NULL OR length(_model) > 200 OR _model !~ '^[A-Za-z0-9._:/-]+$' THEN RAISE EXCEPTION 'invalid model'; END IF;
  SELECT * INTO cur FROM garage_managed_models WHERE garage_id = _garage_id AND model = _model;
  IF _action = 'pull' THEN
    INSERT INTO garage_managed_models (garage_id, model, action, "by", status, requested_at)
    VALUES (_garage_id, _model, 'pull', _by, 'wanted', now())
    ON CONFLICT (garage_id, model) DO UPDATE SET action = 'pull', "by" = _by, status = 'wanted', completed_mb = NULL, total_mb = NULL, error = NULL, requested_at = now(), reported_at = NULL;
  ELSIF _action = 'remove' THEN
    IF cur IS NULL OR cur.action <> 'pull' OR cur.status <> 'ready' THEN RAISE EXCEPTION 'only models Bridge fetched can be removed'; END IF;
    UPDATE garage_managed_models SET action = 'remove', "by" = _by, status = 'wanted', error = NULL, requested_at = now(), reported_at = NULL WHERE garage_id = _garage_id AND model = _model;
  ELSE RAISE EXCEPTION 'invalid action'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.apply_managed_model_cancel(_garage_id uuid, _model text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE garage_managed_models SET action = 'pull', status = 'ready', error = NULL WHERE garage_id = _garage_id AND model = _model AND action = 'remove' AND status <> 'removed';
  DELETE FROM garage_managed_models WHERE garage_id = _garage_id AND model = _model AND action = 'pull' AND status <> 'ready';
END $$;

REVOKE ALL ON FUNCTION public.apply_managed_model_request(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_managed_model_cancel(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_managed_model_request(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_managed_model_cancel(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.request_managed_model(_garage_id uuid, _model text, _action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM garages WHERE id = _garage_id AND (operator_id = auth.uid() OR has_role(auth.uid(), 'admin'))) THEN RAISE EXCEPTION 'not your garage'; END IF;
  PERFORM apply_managed_model_request(_garage_id, _model, _action, 'operator');
END $$;

CREATE OR REPLACE FUNCTION public.cancel_managed_model(_garage_id uuid, _model text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM garages WHERE id = _garage_id AND (operator_id = auth.uid() OR has_role(auth.uid(), 'admin'))) THEN RAISE EXCEPTION 'not your garage'; END IF;
  PERFORM apply_managed_model_cancel(_garage_id, _model);
END $$;