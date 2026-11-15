CREATE TABLE IF NOT EXISTS public.garage_status_summary (
  garage_id uuid PRIMARY KEY REFERENCES public.garages(id) ON DELETE CASCADE,
  first_sampled_at timestamptz NOT NULL,
  first_online_at timestamptz,
  last_online_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.garage_status_summary IS 'All-time per-garage status facts (first sample, first/last online) kept so garage_status_samples can later be pruned to 30 days; maintained by insert trigger.';
GRANT ALL ON public.garage_status_summary TO service_role;
ALTER TABLE public.garage_status_summary ENABLE ROW LEVEL SECURITY;

INSERT INTO public.garage_status_summary (garage_id, first_sampled_at, first_online_at, last_online_at)
SELECT garage_id, min(sampled_at), min(sampled_at) FILTER (WHERE online), max(sampled_at) FILTER (WHERE online)
FROM public.garage_status_samples GROUP BY garage_id
ON CONFLICT (garage_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.roll_garage_status_summary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.garage_status_summary AS s (garage_id, first_sampled_at, first_online_at, last_online_at)
  VALUES (NEW.garage_id, NEW.sampled_at, CASE WHEN NEW.online THEN NEW.sampled_at END, CASE WHEN NEW.online THEN NEW.sampled_at END)
  ON CONFLICT (garage_id) DO UPDATE SET
    first_sampled_at = least(s.first_sampled_at, EXCLUDED.first_sampled_at),
    first_online_at = CASE WHEN EXCLUDED.first_online_at IS NULL THEN s.first_online_at ELSE least(coalesce(s.first_online_at, EXCLUDED.first_online_at), EXCLUDED.first_online_at) END,
    last_online_at = greatest(s.last_online_at, EXCLUDED.last_online_at),
    updated_at = now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.roll_garage_status_summary() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS garage_status_samples_rollup ON public.garage_status_samples;
CREATE TRIGGER garage_status_samples_rollup AFTER INSERT ON public.garage_status_samples
FOR EACH ROW EXECUTE FUNCTION public.roll_garage_status_summary();