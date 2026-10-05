ALTER TABLE public.garages ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS garages_operator_id_idx ON public.garages(operator_id);
CREATE INDEX IF NOT EXISTS garage_tokens_garage_created_idx ON public.garage_tokens(garage_id, created_at);
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));