CREATE OR REPLACE FUNCTION public.apply_managed_model_cancel(_garage_id uuid, _model text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Pending remove: back to a fetched model.
  UPDATE garage_managed_models SET action = 'pull', status = 'ready', error = NULL WHERE garage_id = _garage_id AND model = _model AND action = 'remove' AND status <> 'removed';
  -- Bridge already downloading/ready: cancel becomes a remove request so the fetched model is not orphaned.
  UPDATE garage_managed_models SET action = 'remove', status = 'wanted', error = NULL, requested_at = now(), reported_at = NULL
    WHERE garage_id = _garage_id AND model = _model AND action = 'pull' AND status IN ('downloading', 'ready');
  -- Nothing fetched yet (wanted, failed, refused): drop the wish.
  DELETE FROM garage_managed_models WHERE garage_id = _garage_id AND model = _model AND action = 'pull' AND status IN ('wanted', 'failed', 'refused');
END $$;
REVOKE ALL ON FUNCTION public.apply_managed_model_cancel(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_managed_model_cancel(uuid, text) TO service_role;