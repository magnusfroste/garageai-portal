ALTER TABLE public.profiles ADD COLUMN connect_page_seen_at timestamptz;
ALTER TABLE public.bridge_links ADD COLUMN entry text CHECK (entry IN ('web','terminal'));
CREATE OR REPLACE FUNCTION public.mark_connect_page_seen()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET connect_page_seen_at = now() WHERE id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.mark_connect_page_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_connect_page_seen() TO authenticated;