CREATE TABLE public.garage_model_memory (
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  model text NOT NULL,
  offered boolean NOT NULL,
  pool_input_cost_per_million numeric,
  pool_output_cost_per_million numeric,
  dedicated_input_cost_per_million numeric,
  dedicated_output_cost_per_million numeric,
  pool_cache_read_cost_per_million numeric,
  dedicated_cache_read_cost_per_million numeric,
  removed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (garage_id, model)
);
GRANT ALL ON public.garage_model_memory TO service_role;
ALTER TABLE public.garage_model_memory ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.garage_model_memory IS 'Offer choice and per-model prices of garage models removed after missed heartbeats; restored when the model is reported again (e.g. after a runtime switch / re-link).';