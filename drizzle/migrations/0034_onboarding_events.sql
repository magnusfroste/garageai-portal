CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  step text NOT NULL CHECK (char_length(step) <= 200),
  status text NOT NULL CHECK (status IN ('started','warning','failed','stopped','done')),
  message text CHECK (char_length(message) <= 500),
  script_version text CHECK (char_length(script_version) <= 200),
  node_name text CHECK (char_length(node_name) <= 200),
  runtime text CHECK (char_length(runtime) <= 200),
  port text CHECK (char_length(port) <= 200),
  os text CHECK (char_length(os) <= 200),
  arch text CHECK (char_length(arch) <= 200),
  gpu text CHECK (char_length(gpu) <= 200),
  memory_gb text CHECK (char_length(memory_gb) <= 200)
);
CREATE INDEX IF NOT EXISTS onboarding_events_garage_created_idx ON public.onboarding_events (garage_id, created_at DESC);
GRANT SELECT ON public.onboarding_events TO authenticated;
GRANT ALL ON public.onboarding_events TO service_role;
ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators read own onboarding events" ON public.onboarding_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.garages g WHERE g.id = onboarding_events.garage_id AND g.operator_id = auth.uid()));
CREATE POLICY "Admins read all onboarding events" ON public.onboarding_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));