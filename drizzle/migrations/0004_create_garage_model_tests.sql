CREATE TABLE IF NOT EXISTS public.garage_model_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  model text NOT NULL,
  passed boolean NOT NULL,
  http_status int,
  error text,
  ttft_ms int,
  duration_ms int,
  output_tokens int,
  tokens_per_second numeric,
  instruction_followed boolean,
  tested_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS garage_model_tests_garage_model_tested_idx
  ON public.garage_model_tests (garage_id, model, tested_at DESC);
GRANT SELECT ON public.garage_model_tests TO authenticated;
GRANT ALL ON public.garage_model_tests TO service_role;
ALTER TABLE public.garage_model_tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view garage model tests" ON public.garage_model_tests;
CREATE POLICY "Admins view garage model tests" ON public.garage_model_tests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Operators view own garage model tests" ON public.garage_model_tests;
CREATE POLICY "Operators view own garage model tests" ON public.garage_model_tests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.garages g WHERE g.id = garage_id AND g.operator_id = auth.uid()));