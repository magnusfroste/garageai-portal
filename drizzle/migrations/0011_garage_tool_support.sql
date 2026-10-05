ALTER TABLE public.garage_model_tests ADD COLUMN IF NOT EXISTS supports_tools boolean, ADD COLUMN IF NOT EXISTS tools_error text;

CREATE OR REPLACE FUNCTION public.garage_tool_support()
 RETURNS TABLE(garage_name text, model text, supports_tools boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT DISTINCT ON (g.name, t.model) g.name, t.model, t.supports_tools
  FROM public.garage_model_tests t JOIN public.garages g ON g.id = t.garage_id
  WHERE t.supports_tools IS NOT NULL
  ORDER BY g.name, t.model, t.tested_at DESC
$$;
REVOKE ALL ON FUNCTION public.garage_tool_support() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.garage_tool_support() TO anon, authenticated, service_role;