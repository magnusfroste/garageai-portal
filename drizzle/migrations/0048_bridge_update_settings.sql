CREATE OR REPLACE FUNCTION public.record_bridge_release(p_version text, p_tag text, p_checked_at timestamptz, p_published_at timestamptz)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
 INSERT INTO public.admin_settings(key,value) VALUES ('bridge_latest',jsonb_build_object('version',p_version,'tag',p_tag,'checked_at',p_checked_at,'published_at',p_published_at))
 ON CONFLICT (key) DO UPDATE SET value=coalesce(admin_settings.value,'{}'::jsonb)||excluded.value,updated_at=now();
$$;
REVOKE EXECUTE ON FUNCTION public.record_bridge_release(text,text,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_bridge_release(text,text,timestamptz,timestamptz) TO service_role;

-- Atomic merge of bridge_update; null arguments keep the stored value. Admins (or the service role cron) only.
CREATE OR REPLACE FUNCTION public.set_bridge_update(p_stable text DEFAULT NULL, p_mode text DEFAULT NULL, p_auto_after_hours integer DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE patch jsonb := '{}'::jsonb; result jsonb;
BEGIN
 IF NOT (coalesce(auth.role(),'') = 'service_role' OR public.has_role(auth.uid(), 'admin')) THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF p_stable IS NOT NULL THEN
   IF p_stable !~ '^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$' THEN RAISE EXCEPTION 'Invalid version'; END IF;
   patch := patch || jsonb_build_object('stable', p_stable, 'stable_at', now());
 END IF;
 IF p_mode IS NOT NULL THEN
   IF p_mode NOT IN ('manual','auto') THEN RAISE EXCEPTION 'Invalid mode'; END IF;
   patch := patch || jsonb_build_object('mode', p_mode);
 END IF;
 IF p_auto_after_hours IS NOT NULL THEN
   IF p_auto_after_hours < 0 OR p_auto_after_hours > 720 THEN RAISE EXCEPTION 'Invalid hours'; END IF;
   patch := patch || jsonb_build_object('auto_after_hours', p_auto_after_hours);
 END IF;
 INSERT INTO public.admin_settings(key,value) VALUES ('bridge_update', '{"mode":"auto","auto_after_hours":24}'::jsonb || patch)
 ON CONFLICT (key) DO UPDATE SET value = coalesce(admin_settings.value,'{}'::jsonb) || patch, updated_at = now()
 RETURNING value INTO result;
 RETURN result;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_bridge_update(text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_bridge_update(text,text,integer) TO authenticated, service_role;

CREATE POLICY "Signed-in users can read Bridge update setting" ON public.admin_settings FOR SELECT TO authenticated USING (key = 'bridge_update');