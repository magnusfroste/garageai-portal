ALTER TABLE public.garages ALTER COLUMN transport SET DEFAULT 'tunnel';
ALTER TABLE public.bridge_links ALTER COLUMN transport SET DEFAULT 'tunnel';
ALTER TABLE public.garages DROP CONSTRAINT garages_transport_check;
ALTER TABLE public.garages ADD CONSTRAINT garages_transport_check CHECK (transport IN ('tunnel', 'endpoint')) NOT VALID;
ALTER TABLE public.bridge_links DROP CONSTRAINT bridge_links_transport_check;
ALTER TABLE public.bridge_links ADD CONSTRAINT bridge_links_transport_check CHECK (transport IN ('tunnel', 'endpoint')) NOT VALID;
CREATE OR REPLACE FUNCTION public.guard_transport_history() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.transport NOT IN ('tunnel','endpoint') THEN RAISE EXCEPTION 'transport must be tunnel or endpoint'; END IF;
  ELSIF NEW.transport IS DISTINCT FROM OLD.transport AND NEW.transport NOT IN ('tunnel','endpoint') THEN
    RAISE EXCEPTION 'transport must be tunnel or endpoint';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER garages_transport_history BEFORE INSERT OR UPDATE OF transport ON public.garages FOR EACH ROW EXECUTE FUNCTION public.guard_transport_history();
CREATE TRIGGER bridge_links_transport_history BEFORE INSERT OR UPDATE OF transport ON public.bridge_links FOR EACH ROW EXECUTE FUNCTION public.guard_transport_history();
COMMENT ON COLUMN public.garages.netbird_peer_id IS 'DEPRECATED: Bridge tunnel replaces NetBird; retained for historical data only';
COMMENT ON COLUMN public.garages.mesh_ip IS 'DEPRECATED: use tunnel_ip for Bridge address; retained for existing routing compatibility';
COMMENT ON CONSTRAINT garages_transport_check ON public.garages IS 'NOT VALID temporarily for legacy rows; new transport values are tunnel or endpoint';
COMMENT ON CONSTRAINT bridge_links_transport_check ON public.bridge_links IS 'NOT VALID to retain historical netbird links; new transport values are tunnel or endpoint';