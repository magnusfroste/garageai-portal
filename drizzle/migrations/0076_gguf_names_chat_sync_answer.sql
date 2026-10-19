CREATE OR REPLACE FUNCTION public.model_quantization(_id text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $f$
  SELECT upper(substring(regexp_replace(trim(_id), '\.gguf$', '', 'i') from '(?i)[-_.:]((?:(?:ud|mix|i?q[0-9]+(?:_[a-z0-9]+)*|bf16|f16|f32)[-_.])*(?:i?q[0-9]+(?:_[a-z0-9]+)*|bf16|f16|f32)(?:[-_.]mix)?)$'))
$f$;
CREATE OR REPLACE FUNCTION public.normalise_model_id(_id text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $function$
DECLARE s text; p int; org text; nm text; creator text; gguf boolean; fam text; rest text;
  qre constant text := '[-_.:]((?:(?:ud|mix|i?q[0-9]+(?:_[a-z0-9]+)*|bf16|f16|f32)[-_.])*(?:i?q[0-9]+(?:_[a-z0-9]+)*|bf16|f16|f32)(?:[-_.]mix)?)$';
BEGIN
  IF _id IS NULL THEN RETURN NULL; END IF;
  s := trim(_id);
  gguf := s ~* '\.gguf$';
  s := regexp_replace(s, '\.gguf$', '', 'i');
  IF s ~* qre THEN gguf := true; s := regexp_replace(s, qre, '', 'i'); END IF;
  s := trim(both '-' from regexp_replace(regexp_replace(replace(lower(s), ':', '-'), '-latest$', ''), '-{2,}', '-', 'g'));
  nm := substr(s, position('/' in s) + 1);
  IF nm ~ '^gemma-4-e2b-it$' THEN RETURN 'google/gemma-4-e2b-it'; END IF;
  IF nm ~ '^qwen3-30b-a3b(-.*)?-selective(-.*)?$' THEN RETURN 'qwen/qwen3-30b-a3b'; END IF;
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
      WHEN 'zai-org' THEN 'z-ai' WHEN 'thudm' THEN 'z-ai' WHEN 'ibm-granite' THEN 'ibm-granite' WHEN 'ibm' THEN 'ibm-granite'
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
    WHEN nm LIKE 'ministral%' THEN 'mistralai' WHEN nm LIKE 'granite%' THEN 'ibm-granite'
    ELSE NULL END;
  RETURN CASE WHEN creator IS NULL THEN nm ELSE creator || '/' || nm END;
END $function$;

UPDATE public.garage_models SET canonical_model = public.normalise_model_id(model)
 WHERE canonical_source = 'auto' AND canonical_model IS DISTINCT FROM public.normalise_model_id(model);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chat_sync_answered_at timestamptz;
CREATE OR REPLACE FUNCTION public.set_chat_sync(_on boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  UPDATE public.profiles SET chat_sync = _on, chat_sync_answered_at = now() WHERE id = auth.uid() RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
  RETURN jsonb_build_object('chat_sync', r.chat_sync, 'chat_sync_answered_at', r.chat_sync_answered_at);
END $$;
REVOKE ALL ON FUNCTION public.set_chat_sync(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_chat_sync(boolean) TO authenticated;