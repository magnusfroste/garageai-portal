CREATE POLICY "Signed-in users can read Bridge version" ON public.admin_settings FOR SELECT TO authenticated USING (key = 'bridge_latest');
CREATE OR REPLACE FUNCTION public.set_bridge_pin(p_pinned text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF p_pinned IS NOT NULL AND p_pinned !~ '^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$' THEN RAISE EXCEPTION 'Invalid version'; END IF;
 INSERT INTO public.admin_settings(key,value) VALUES ('bridge_latest', jsonb_build_object('pinned',p_pinned)) ON CONFLICT (key) DO UPDATE SET value=jsonb_set(coalesce(admin_settings.value,'{}'::jsonb),'{pinned}',to_jsonb(coalesce(p_pinned,''))), updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.set_bridge_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_bridge_pin(text) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.record_bridge_release(p_version text,p_tag text,p_checked_at timestamptz) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 INSERT INTO public.admin_settings(key,value) VALUES ('bridge_latest',jsonb_build_object('version',p_version,'tag',p_tag,'checked_at',p_checked_at)) ON CONFLICT (key) DO UPDATE SET value=coalesce(admin_settings.value,'{}'::jsonb)||excluded.value,updated_at=now();
$$;
REVOKE ALL ON FUNCTION public.record_bridge_release(text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_bridge_release(text,text,timestamptz) TO service_role;