CREATE OR REPLACE FUNCTION public.garage_public_providers()
RETURNS TABLE(garage_name text, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT name, coalesce(display_name, name) FROM public.garages WHERE connection_type = 'endpoint' $$;
GRANT EXECUTE ON FUNCTION public.garage_public_providers() TO anon, authenticated;