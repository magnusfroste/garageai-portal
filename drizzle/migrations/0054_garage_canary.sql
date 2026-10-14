ALTER TABLE public.garages ADD COLUMN canary boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_garage_canary() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.canary IS DISTINCT FROM OLD.canary AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'only admins can change the canary flag' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER garages_guard_canary BEFORE UPDATE OF canary ON public.garages FOR EACH ROW EXECUTE FUNCTION public.guard_garage_canary();

CREATE OR REPLACE FUNCTION public.set_garage_canary(_garage_id uuid, _canary boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'only admins can change the canary flag' USING ERRCODE = '42501'; END IF;
  UPDATE public.garages SET canary = _canary WHERE id = _garage_id;
END $$;
REVOKE ALL ON FUNCTION public.set_garage_canary(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_garage_canary(uuid, boolean) TO authenticated;