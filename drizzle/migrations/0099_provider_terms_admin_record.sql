ALTER TABLE public.garages ADD COLUMN IF NOT EXISTS terms_accepted_by uuid, ADD COLUMN IF NOT EXISTS terms_accepted_via text, ADD COLUMN IF NOT EXISTS terms_note text;
CREATE TABLE public.garage_terms_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('record','clear')),
  terms_version text,
  accepted_at timestamptz,
  note text,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.garage_terms_events TO authenticated;
GRANT ALL ON public.garage_terms_events TO service_role;
ALTER TABLE public.garage_terms_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read provider terms events" ON public.garage_terms_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX garage_terms_events_garage_idx ON public.garage_terms_events (garage_id, created_at DESC);