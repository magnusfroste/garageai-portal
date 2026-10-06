CREATE OR REPLACE FUNCTION public.normalise_model_id(_id text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(both '-' from regexp_replace(
    regexp_replace(
      replace(CASE WHEN position('/' in lower(_id)) > 0 THEN substr(lower(_id), position('/' in lower(_id)) + 1) ELSE lower(_id) END, ':', '-'),
      '-latest$', ''),
    '-{2,}', '-', 'g'))
$$;

ALTER TABLE public.garage_models ADD COLUMN canonical_model text NOT NULL DEFAULT '';
ALTER TABLE public.garage_models ADD COLUMN canonical_source text NOT NULL DEFAULT 'auto';
ALTER TABLE public.garage_models ADD COLUMN private boolean NOT NULL DEFAULT false;
UPDATE public.garage_models SET canonical_model = public.normalise_model_id(model);
ALTER TABLE public.garage_models ADD CONSTRAINT garage_models_canonical_source_check CHECK (canonical_source IN ('auto','admin'));
COMMENT ON COLUMN public.garage_models.model IS 'Runtime id: exactly what the runtime reports in /v1/models and what is sent upstream. Never shown to buyers.';
COMMENT ON COLUMN public.garage_models.canonical_model IS 'Catalogue name and pool route. Auto = normalise_model_id(model); admin alias only for endpoint providers.';

CREATE OR REPLACE FUNCTION public.garage_models_canonical()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ctype text;
BEGIN
  IF TG_OP = 'UPDATE' AND current_user NOT IN ('service_role','postgres','supabase_admin')
     AND (NEW.canonical_model IS DISTINCT FROM OLD.canonical_model OR NEW.canonical_source IS DISTINCT FROM OLD.canonical_source OR NEW.private IS DISTINCT FROM OLD.private) THEN
    RAISE EXCEPTION 'canonical model fields can only be changed by the platform';
  END IF;
  SELECT connection_type INTO ctype FROM public.garages WHERE id = NEW.garage_id;
  IF ctype IS DISTINCT FROM 'endpoint' THEN NEW.canonical_source := 'auto'; NEW.private := false; END IF;
  IF NEW.canonical_source = 'auto' OR coalesce(NEW.canonical_model, '') = '' THEN
    NEW.canonical_source := 'auto';
    NEW.canonical_model := public.normalise_model_id(NEW.model);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER garage_models_canonical BEFORE INSERT OR UPDATE ON public.garage_models
FOR EACH ROW EXECUTE FUNCTION public.garage_models_canonical();

CREATE OR REPLACE FUNCTION public.garage_tool_support()
 RETURNS TABLE(garage_name text, model text, supports_tools boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT DISTINCT ON (x.name, x.cm) x.name, x.cm, x.supports_tools FROM (
    SELECT g.name, coalesce(gm.canonical_model, t.model) AS cm, t.supports_tools, t.tested_at
    FROM public.garage_model_tests t JOIN public.garages g ON g.id = t.garage_id
    LEFT JOIN public.garage_models gm ON gm.garage_id = t.garage_id AND gm.model = t.model
    WHERE t.supports_tools IS NOT NULL
  ) x ORDER BY x.name, x.cm, x.tested_at DESC
$$;

CREATE OR REPLACE FUNCTION public.garage_public_models()
 RETURNS TABLE(garage_name text, model text, private boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT DISTINCT g.name, gm.canonical_model, gm.private
  FROM public.garage_models gm JOIN public.garages g ON g.id = gm.garage_id
  WHERE gm.offered AND gm.installed AND NOT g.disabled
$$;
GRANT EXECUTE ON FUNCTION public.garage_public_models() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.garage_tool_support() TO anon, authenticated;