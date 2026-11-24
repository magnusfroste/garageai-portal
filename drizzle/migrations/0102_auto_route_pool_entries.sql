ALTER TABLE public.auto_route ADD COLUMN pool_model text;
ALTER TABLE public.auto_route ALTER COLUMN curated_model_id DROP NOT NULL;
ALTER TABLE public.auto_route ADD CONSTRAINT auto_route_exactly_one_target CHECK ((curated_model_id IS NOT NULL) <> (pool_model IS NOT NULL));