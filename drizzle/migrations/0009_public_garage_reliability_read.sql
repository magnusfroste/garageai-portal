-- Public read of aggregate garage reliability/profile data (no emails, IPs, tokens).
GRANT EXECUTE ON FUNCTION public.garage_reliability(text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.garage_profile(text) TO anon;