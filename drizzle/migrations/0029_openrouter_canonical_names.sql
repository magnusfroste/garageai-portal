-- OpenRouter-style canonical names <creator>/<model>. Mirrors supabase/functions/_shared/modelIdentity.ts exactly.
CREATE OR REPLACE FUNCTION public.normalise_model_id(_id text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE s text; p int; org text; nm text; creator text;
BEGIN
  IF _id IS NULL THEN RETURN NULL; END IF;
  s := trim(both '-' from regexp_replace(regexp_replace(replace(lower(_id), ':', '-'), '-latest$', ''), '-{2,}', '-', 'g'));
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
END $$;

UPDATE public.garage_models SET canonical_model = public.normalise_model_id(model) WHERE canonical_source = 'auto';