CREATE OR REPLACE FUNCTION public.garage_tool_support()
 RETURNS TABLE(garage_name text, model text, supports_tools boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT * FROM (
    SELECT DISTINCT ON (x.name, x.cm) x.name, x.cm, x.supports_tools FROM (
      SELECT g.name, coalesce(gm.canonical_model, t.model) AS cm, t.supports_tools, t.tested_at
      FROM public.garage_model_tests t JOIN public.garages g ON g.id = t.garage_id
      LEFT JOIN public.garage_models gm ON gm.garage_id = t.garage_id AND gm.model = t.model
      WHERE t.supports_tools IS NOT NULL AND (g.visibility = 'market' OR g.operator_id = auth.uid())
    ) x ORDER BY x.name, x.cm, x.tested_at DESC
  ) a
  UNION ALL
  SELECT 'auto'::text, coalesce(c.model_name, c.id), c.supports_tools
  FROM public.curated_models c WHERE c.garage_tier = 'auto' AND c.supports_tools IS NOT NULL
$$;