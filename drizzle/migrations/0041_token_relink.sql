ALTER TABLE public.garage_tokens ADD COLUMN IF NOT EXISTS relink boolean NOT NULL DEFAULT false;
