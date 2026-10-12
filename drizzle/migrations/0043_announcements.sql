CREATE TABLE public.announcements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (length(trim(title)) > 0),
 body text NOT NULL CHECK (char_length(body) <= 300),
 link_url text,
 link_text text,
 audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all','operators','buyers')),
 level text NOT NULL DEFAULT 'info' CHECK (level IN ('info','warning')),
 starts_at timestamptz NOT NULL DEFAULT now(),
 ends_at timestamptz,
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT announcement_window CHECK (ends_at IS NULL OR ends_at >= starts_at),
 CONSTRAINT announcement_link CHECK (link_url IS NULL OR link_url ~ '^https?://')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Current audience announcements" ON public.announcements FOR SELECT TO authenticated USING (
 starts_at <= now() AND (ends_at IS NULL OR ends_at > now()) AND (
 audience = 'all' OR
 (audience = 'operators' AND EXISTS (SELECT 1 FROM public.garages g WHERE g.operator_id = auth.uid())) OR
 (audience = 'buyers' AND NOT EXISTS (SELECT 1 FROM public.garages g WHERE g.operator_id = auth.uid()))
 ));
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX announcements_newest ON public.announcements(created_at DESC);