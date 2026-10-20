ALTER TABLE public.garages ADD COLUMN visibility text NOT NULL DEFAULT 'market' CHECK (visibility IN ('market','private'));
COMMENT ON COLUMN public.garages.visibility IS 'Market participation only; owner mine routes remain independent.';
CREATE OR REPLACE FUNCTION public.market_garage_visible(_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.garages WHERE name=_name AND visibility='market') $$;
REVOKE ALL ON FUNCTION public.market_garage_visible(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_garage_visible(text) TO anon, authenticated, service_role;
ALTER POLICY "Anyone can read curated models" ON public.curated_models USING (coalesce(garage_tier,'') <> 'private' AND coalesce(model_name,id) NOT LIKE 'mine/%' AND (garage IS NULL OR garage_tier='auto' OR public.market_garage_visible(garage)));
DO $migration$
DECLARE fn text; definition text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['garage_profile','garage_public_stats','garage_public_locations','garage_public_models','garage_public_providers','garage_tool_support','garage_daily_tokens','garage_reliability'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=fn;
    IF fn IN ('garage_profile','garage_public_stats','garage_public_locations','garage_public_models') THEN
      definition := replace(definition, 'NOT g.disabled', 'NOT g.disabled AND g.visibility = ''market''');
    ELSIF fn='garage_public_providers' THEN
      definition := replace(definition, 'WHERE connection_type = ''endpoint''', 'WHERE visibility = ''market'' AND connection_type = ''endpoint''');
    ELSIF fn='garage_tool_support' THEN
      definition := replace(definition, 'WHERE t.supports_tools IS NOT NULL', 'WHERE g.visibility = ''market'' AND t.supports_tools IS NOT NULL');
    ELSIF fn='garage_daily_tokens' THEN
      definition := replace(definition, 'WHERE g.name = ANY(_names)', 'WHERE g.visibility = ''market'' AND g.name = ANY(_names)');
    ELSIF fn='garage_reliability' THEN
      definition := replace(definition, 'WHERE _names IS NULL OR name = ANY(_names)', 'WHERE visibility = ''market'' AND (_names IS NULL OR name = ANY(_names))');
    END IF;
    EXECUTE definition;
  END LOOP;
END $migration$;
CREATE OR REPLACE FUNCTION public.set_machine_visibility(_garage_id uuid, _visibility text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF _visibility IS NULL OR _visibility NOT IN ('market','private') THEN RAISE EXCEPTION 'Invalid visibility'; END IF;
  UPDATE public.garages SET visibility=_visibility WHERE id=_garage_id AND operator_id=auth.uid() AND connection_type<>'endpoint';
  IF NOT FOUND THEN RAISE EXCEPTION 'Machine not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_machine_visibility(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_machine_visibility(uuid,text) TO authenticated;
