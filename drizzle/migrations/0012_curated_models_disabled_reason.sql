ALTER TABLE public.curated_models ADD COLUMN IF NOT EXISTS disabled_reason text;
ALTER TABLE public.curated_models DROP CONSTRAINT IF EXISTS curated_models_disabled_reason_check;

UPDATE public.curated_models c SET enabled = true, disabled_reason = NULL, updated_at = now()
WHERE NOT c.enabled AND c.garage IS NOT NULL AND (
  SELECT t.passed FROM public.garage_model_tests t JOIN public.garages g ON g.id = t.garage_id
  WHERE g.name = c.garage AND t.model = CASE WHEN c.garage_tier = 'dedicated' AND c.model_name LIKE 'garage/' || c.garage || '/%'
    THEN substr(c.model_name, length('garage/' || c.garage || '/') + 1) ELSE c.model_name END
  ORDER BY t.tested_at DESC LIMIT 1
) IS TRUE;

UPDATE public.curated_models SET disabled_reason = 'admin' WHERE NOT enabled AND disabled_reason IS NULL;

ALTER TABLE public.curated_models ADD CONSTRAINT curated_models_disabled_reason_check
  CHECK (disabled_reason IS NULL OR disabled_reason IN ('admin', 'failed_test'));