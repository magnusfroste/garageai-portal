CREATE TABLE public.auto_route (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position integer NOT NULL CHECK (position >= 1),
  curated_model_id text NOT NULL REFERENCES public.curated_models(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (curated_model_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_route TO authenticated;
GRANT ALL ON public.auto_route TO service_role;
ALTER TABLE public.auto_route ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage auto route" ON public.auto_route FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.curated_models ADD COLUMN supports_tools boolean;

CREATE OR REPLACE FUNCTION public.garage_tool_support()
 RETURNS TABLE(garage_name text, model text, supports_tools boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT * FROM (
    SELECT DISTINCT ON (x.name, x.cm) x.name, x.cm, x.supports_tools FROM (
      SELECT g.name, coalesce(gm.canonical_model, t.model) AS cm, t.supports_tools, t.tested_at
      FROM public.garage_model_tests t JOIN public.garages g ON g.id = t.garage_id
      LEFT JOIN public.garage_models gm ON gm.garage_id = t.garage_id AND gm.model = t.model
      WHERE t.supports_tools IS NOT NULL
    ) x ORDER BY x.name, x.cm, x.tested_at DESC
  ) a
  UNION ALL
  SELECT 'auto'::text, coalesce(c.model_name, c.id), c.supports_tools
  FROM public.curated_models c WHERE c.garage_tier = 'auto' AND c.supports_tools IS NOT NULL
$$;
GRANT EXECUTE ON FUNCTION public.garage_tool_support() TO anon, authenticated;