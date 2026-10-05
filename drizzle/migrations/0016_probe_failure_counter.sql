ALTER TABLE public.garage_model_tests ADD COLUMN IF NOT EXISTS inconclusive boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.garage_model_failures (
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  model text NOT NULL,
  consecutive_failures integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (garage_id, model)
);
GRANT ALL ON public.garage_model_failures TO service_role;
ALTER TABLE public.garage_model_failures ENABLE ROW LEVEL SECURITY;