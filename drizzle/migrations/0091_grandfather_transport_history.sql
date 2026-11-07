ALTER TABLE public.garages DROP CONSTRAINT garages_transport_check;
ALTER TABLE public.garages ADD CONSTRAINT garages_transport_check CHECK (transport IN ('tunnel', 'endpoint', 'netbird'));
ALTER TABLE public.bridge_links DROP CONSTRAINT bridge_links_transport_check;
ALTER TABLE public.bridge_links ADD CONSTRAINT bridge_links_transport_check CHECK (transport IN ('tunnel', 'endpoint', 'netbird'));
COMMENT ON CONSTRAINT garages_transport_check ON public.garages IS 'Legacy netbird values retained; guard_transport_history forbids new netbird values';
COMMENT ON CONSTRAINT bridge_links_transport_check ON public.bridge_links IS 'Historical netbird links retained; guard_transport_history forbids new netbird values';