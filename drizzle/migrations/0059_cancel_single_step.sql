CREATE OR REPLACE FUNCTION public.apply_managed_model_cancel(_garage_id uuid, _model text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cur record;
BEGIN
  SELECT * INTO cur FROM garage_managed_models WHERE garage_id = _garage_id AND model = _model FOR UPDATE;
  IF cur IS NULL THEN RETURN; END IF;
  IF cur.action = 'remove' AND cur.status <> 'removed' THEN
    UPDATE garage_managed_models SET action = 'pull', status = 'ready', error = NULL WHERE garage_id = _garage_id AND model = _model;
  ELSIF cur.action = 'pull' AND cur.status IN ('downloading', 'ready') THEN
    -- Bridge already fetched (or is fetching): cancel becomes a remove request, so nothing is orphaned.
    UPDATE garage_managed_models SET action = 'remove', status = 'wanted', error = NULL, requested_at = now(), reported_at = NULL WHERE garage_id = _garage_id AND model = _model;
  ELSIF cur.action = 'pull' THEN
    DELETE FROM garage_managed_models WHERE garage_id = _garage_id AND model = _model;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.apply_managed_model_cancel(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_managed_model_cancel(uuid, text) TO service_role;