ALTER TABLE public.garage_models ADD COLUMN IF NOT EXISTS quantization text;

CREATE OR REPLACE FUNCTION public.model_quantization(_id text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT upper(substring(regexp_replace(trim(_id), '\.gguf$', '', 'i') from '(?i)[-_.:]((?:i?q[0-9]+(?:_[a-z0-9]+)*)|bf16|f16|f32)$'))
$$;

CREATE OR REPLACE FUNCTION public.normalise_model_id(_id text)
 RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $function$
DECLARE s text; p int; org text; nm text; creator text; gguf boolean; fam text; rest text;
BEGIN
  IF _id IS NULL THEN RETURN NULL; END IF;
  s := trim(_id);
  gguf := s ~* '\.gguf$';
  s := regexp_replace(s, '\.gguf$', '', 'i');
  IF s ~* '[-_.:]((?:i?q[0-9]+(?:_[a-z0-9]+)*)|bf16|f16|f32)$' THEN
    gguf := true;
    s := regexp_replace(s, '[-_.:]((?:i?q[0-9]+(?:_[a-z0-9]+)*)|bf16|f16|f32)$', '', 'i');
  END IF;
  s := trim(both '-' from regexp_replace(regexp_replace(replace(lower(s), ':', '-'), '-latest$', ''), '-{2,}', '-', 'g'));
  IF gguf AND position('/' in s) = 0 THEN
    FOREACH fam IN ARRAY ARRAY['qwen','llama','gemma','mistral','mixtral','deepseek','nemotron','mimo','phi','glm','gpt-oss','codestral','devstral','smollm'] LOOP
      IF s LIKE fam || '-%' THEN
        rest := substr(s, length(fam) + 2);
        IF rest ~ '^[0-9]+(\.[0-9]+)*(-|$)' THEN s := fam || rest; END IF;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  p := position('/' in s);
  IF p > 0 THEN
    org := substr(s, 1, p - 1);
    nm := trim(both '-' from substr(s, p + 1));
    creator := CASE org
      WHEN 'qwen' THEN 'qwen' WHEN 'meta-llama' THEN 'meta-llama' WHEN 'google' THEN 'google'
      WHEN 'mistralai' THEN 'mistralai' WHEN 'deepseek-ai' THEN 'deepseek' WHEN 'nvidia' THEN 'nvidia'
      WHEN 'xiaomimimo' THEN 'xiaomi' WHEN 'xiaomi' THEN 'xiaomi' WHEN 'microsoft' THEN 'microsoft'
      WHEN 'zai-org' THEN 'z-ai' WHEN 'thudm' THEN 'z-ai'
      WHEN 'unsloth' THEN '' WHEN 'lmstudio-community' THEN '' WHEN 'bartowski' THEN ''
      WHEN 'mlx-community' THEN '' WHEN 'ollama' THEN ''
      ELSE org END;
    IF creator <> '' THEN RETURN creator || '/' || nm; END IF;
  ELSE
    nm := s;
  END IF;
  creator := CASE
    WHEN nm LIKE 'qwen%' THEN 'qwen' WHEN nm LIKE 'llama%' THEN 'meta-llama' WHEN nm LIKE 'gemma%' THEN 'google'
    WHEN nm LIKE 'mistral%' THEN 'mistralai' WHEN nm LIKE 'mixtral%' THEN 'mistralai' WHEN nm LIKE 'deepseek%' THEN 'deepseek'
    WHEN nm LIKE 'nemotron%' THEN 'nvidia' WHEN nm LIKE 'mimo%' THEN 'xiaomi' WHEN nm LIKE 'phi%' THEN 'microsoft'
    WHEN nm LIKE 'glm%' THEN 'z-ai' WHEN nm LIKE 'gpt-oss%' THEN 'openai' WHEN nm LIKE 'codestral%' THEN 'mistralai'
    WHEN nm LIKE 'devstral%' THEN 'mistralai' WHEN nm LIKE 'smollm%' THEN 'huggingfacetb'
    ELSE NULL END;
  RETURN CASE WHEN creator IS NULL THEN nm ELSE creator || '/' || nm END;
END $function$;

CREATE OR REPLACE FUNCTION public.garage_models_canonical()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE ctype text;
BEGIN
  IF TG_OP = 'UPDATE' AND current_user NOT IN ('service_role','postgres','supabase_admin')
     AND (NEW.canonical_model IS DISTINCT FROM OLD.canonical_model OR NEW.canonical_source IS DISTINCT FROM OLD.canonical_source OR NEW.private IS DISTINCT FROM OLD.private) THEN
    RAISE EXCEPTION 'canonical model fields can only be changed by the platform';
  END IF;
  NEW.quantization := public.model_quantization(NEW.model);
  SELECT connection_type INTO ctype FROM public.garages WHERE id = NEW.garage_id;
  IF ctype IS DISTINCT FROM 'endpoint' THEN NEW.canonical_source := 'auto'; NEW.private := false; END IF;
  IF NEW.canonical_source = 'auto' OR coalesce(NEW.canonical_model, '') = '' THEN
    NEW.canonical_source := 'auto';
    NEW.canonical_model := public.normalise_model_id(NEW.model);
  END IF;
  RETURN NEW;
END $function$;

UPDATE public.garage_models SET model = model WHERE model ~* '(\.gguf$|[-_.:]((?:i?q[0-9]+(?:_[a-z0-9]+)*)|bf16|f16|f32)$)';