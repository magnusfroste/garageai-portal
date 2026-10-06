ALTER TABLE public.garages
  ADD COLUMN IF NOT EXISTS last_gateway_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS mesh_connected boolean,
  ADD COLUMN IF NOT EXISTS runtime_ok boolean,
  ADD COLUMN IF NOT EXISTS runtime_error text,
  ADD COLUMN IF NOT EXISTS runtime_models text[] NOT NULL DEFAULT '{}'::text[];

CREATE TABLE public.garage_models (
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  model text NOT NULL,
  installed boolean NOT NULL DEFAULT true,
  offered boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'untested' CHECK (status IN ('untested','testing','live','failed','paused')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (garage_id, model)
);

INSERT INTO public.garage_models (garage_id, model, installed, offered, status)
SELECT g.id, m.model, true, true,
  coalesce((SELECT CASE WHEN t.passed THEN 'live' ELSE 'failed' END FROM public.garage_model_tests t
            WHERE t.garage_id = g.id AND t.model = m.model AND NOT t.inconclusive ORDER BY t.tested_at DESC LIMIT 1), 'untested')
FROM public.garages g CROSS JOIN LATERAL unnest(g.models) AS m(model)
ON CONFLICT DO NOTHING;

GRANT SELECT ON public.garage_models TO authenticated;
GRANT UPDATE (offered) ON public.garage_models TO authenticated;
GRANT ALL ON public.garage_models TO service_role;
ALTER TABLE public.garage_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage garage models" ON public.garage_models FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Operators view own garage models" ON public.garage_models FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.garages g WHERE g.id = garage_id AND g.operator_id = auth.uid()));
CREATE POLICY "Operators update own garage models" ON public.garage_models FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.garages g WHERE g.id = garage_id AND g.operator_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.garages g WHERE g.id = garage_id AND g.operator_id = auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read public settings" ON public.admin_settings;
CREATE POLICY "Authenticated can read public settings" ON public.admin_settings FOR SELECT TO authenticated
  USING (key = ANY (ARRAY['site_settings'::text, 'chat_enabled_models'::text, 'chat_default_model'::text, 'demand_models'::text]));