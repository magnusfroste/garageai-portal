CREATE TABLE public.market_prices (
  model_id text PRIMARY KEY,
  input_per_m numeric NOT NULL,
  output_per_m numeric NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.market_prices TO anon, authenticated;
GRANT ALL ON public.market_prices TO service_role;
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read market prices" ON public.market_prices FOR SELECT TO anon, authenticated USING (true);