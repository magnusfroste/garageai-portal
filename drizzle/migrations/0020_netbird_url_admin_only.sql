INSERT INTO public.admin_settings (key, value)
SELECT 'netbird_api_url', to_jsonb(coalesce(value->>'netbird_api_url', ''))
FROM public.admin_settings WHERE key = 'site_settings'
ON CONFLICT (key) DO NOTHING;
UPDATE public.admin_settings SET value = value - 'netbird_api_url', updated_at = now() WHERE key = 'site_settings';