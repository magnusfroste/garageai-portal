ALTER TABLE public.mail_templates ADD COLUMN kind text NOT NULL DEFAULT 'service' CHECK (kind IN ('service','marketing'));
ALTER TABLE public.mail_log ADD COLUMN provider text CHECK (provider IS NULL OR provider IN ('cloudflare','brevo'));
ALTER TABLE public.mail_log DROP CONSTRAINT mail_log_status_check;
ALTER TABLE public.mail_log ADD CONSTRAINT mail_log_status_check CHECK (status IN ('sent','failed','skipped_cap','skipped_opt_out','skipped_provider'));
UPDATE public.admin_settings SET value = value || '{"provider":"cloudflare"}'::jsonb WHERE key='event_mail' AND NOT (value ? 'provider');