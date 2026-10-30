CREATE TABLE public.buyer_first_requests (user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE, first_request_at timestamptz NOT NULL);
GRANT SELECT ON public.buyer_first_requests TO authenticated;
GRANT ALL ON public.buyer_first_requests TO service_role;
ALTER TABLE public.buyer_first_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own first request" ON public.buyer_first_requests FOR SELECT TO authenticated USING (user_id=auth.uid());