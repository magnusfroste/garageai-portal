CREATE TABLE public.support_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','closed')),
 tag text NOT NULL DEFAULT 'other' CHECK(tag IN ('onboarding','connect','models','billing','chat','other')),
 created_at timestamptz NOT NULL DEFAULT now(), last_user_message_at timestamptz, last_admin_message_at timestamptz,
 user_read_at timestamptz, admin_read_at timestamptz, closed_at timestamptz
);
GRANT SELECT ON public.support_threads TO authenticated;
GRANT ALL ON public.support_threads TO service_role;
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_threads_read ON public.support_threads FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX support_threads_user ON public.support_threads(user_id,created_at DESC);
CREATE TABLE public.support_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
 sender text NOT NULL CHECK(sender IN ('user','admin')), body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 4000), context jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_messages_read ON public.support_messages FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.support_threads t WHERE t.id=thread_id AND (t.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE INDEX support_messages_thread ON public.support_messages(thread_id,created_at);
CREATE TABLE public.support_prompt_days(user_id uuid NOT NULL, day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date, PRIMARY KEY(user_id,day));
GRANT SELECT ON public.support_prompt_days TO authenticated;
GRANT ALL ON public.support_prompt_days TO service_role;
ALTER TABLE public.support_prompt_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_prompt_read ON public.support_prompt_days FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.support_safe_text(_text text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT left(regexp_replace(regexp_replace(coalesce(_text,''),'(sk-[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]+)','[redacted]','g'),'(Bearer[[:space:]]+[^[:space:]]+|[A-Za-z_]*(key|token|secret|password)[[:space:]]*[:=][[:space:]]*[^[:space:],;]+)','[redacted]','gi'),500) $$;
CREATE OR REPLACE FUNCTION public.support_send(_body text, _thread_id uuid DEFAULT NULL, _context jsonb DEFAULT NULL, _tag text DEFAULT 'other', _admin boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); tid uuid; t public.support_threads; ctx jsonb; g jsonb; gs jsonb:='[]'::jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to send a message'; END IF;
 IF char_length(trim(coalesce(_body,''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Messages must be between 1 and 4000 characters'; END IF;
 IF _tag NOT IN ('onboarding','connect','models','billing','chat','other') THEN RAISE EXCEPTION 'Invalid support tag'; END IF;
 IF _admin AND NOT public.has_role(uid,'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,21));
 IF _thread_id IS NOT NULL THEN SELECT * INTO t FROM public.support_threads WHERE id=_thread_id FOR UPDATE;
  IF t.id IS NULL OR (NOT _admin AND t.user_id<>uid) THEN RAISE EXCEPTION 'Thread not available'; END IF;
  tid:=t.id;
 ELSE
  IF _admin THEN RAISE EXCEPTION 'Choose a thread to reply'; END IF;
  SELECT * INTO t FROM public.support_threads WHERE user_id=uid AND status<>'closed' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  tid:=t.id;
  IF tid IS NULL THEN
   IF (SELECT count(*) FROM public.support_threads WHERE user_id=uid AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')>=5 THEN RAISE EXCEPTION 'You can open up to 5 threads per day. Try again tomorrow.'; END IF;
   INSERT INTO public.support_threads(user_id,tag) VALUES(uid,_tag) RETURNING id INTO tid;
  END IF;
 END IF;
 IF NOT _admin AND _context IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.support_messages WHERE thread_id=tid) THEN
  IF jsonb_typeof(_context)='object' THEN
   FOR g IN SELECT jsonb_build_object('name',public.support_safe_text(x->>'name'),'bridge_version',public.support_safe_text(x->>'bridge_version'),'problem_codes',coalesce((SELECT jsonb_agg(public.support_safe_text(c #>> '{}')) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(x->'problem_codes')='array' THEN x->'problem_codes' ELSE '[]'::jsonb END) c),'[]'::jsonb)) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_context->'garages')='array' THEN _context->'garages' ELSE '[]'::jsonb END) x LIMIT 20 LOOP gs:=gs||jsonb_build_array(g); END LOOP;
   ctx:=jsonb_build_object('page',public.support_safe_text(split_part(_context->>'page','?',1)),'step',public.support_safe_text(_context->>'step'),'last_error',public.support_safe_text(_context->>'last_error'),'browser',public.support_safe_text(_context->>'browser'),'os',public.support_safe_text(_context->>'os'),'garages',gs);
   IF octet_length(ctx::text)>16384 THEN RAISE EXCEPTION 'Attached context is too large'; END IF;
  END IF;
 END IF;
 INSERT INTO public.support_messages(thread_id,sender,body,context) VALUES(tid,CASE WHEN _admin THEN 'admin' ELSE 'user' END,trim(_body),ctx);
 UPDATE public.support_threads SET status=CASE WHEN _admin THEN 'answered' ELSE 'open' END, closed_at=NULL,
 last_user_message_at=CASE WHEN _admin THEN last_user_message_at ELSE now() END,
 last_admin_message_at=CASE WHEN _admin THEN now() ELSE last_admin_message_at END,
 user_read_at=CASE WHEN _admin THEN user_read_at ELSE now() END,
 admin_read_at=CASE WHEN _admin THEN now() ELSE admin_read_at END WHERE id=tid;
 RETURN tid;
END $$;
REVOKE ALL ON FUNCTION public.support_send(text,uuid,jsonb,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_send(text,uuid,jsonb,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.support_manage(_thread_id uuid, _status text DEFAULT NULL, _tag text DEFAULT NULL, _read boolean DEFAULT false, _admin boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.support_threads;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 IF _admin AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 SELECT * INTO t FROM public.support_threads WHERE id=_thread_id FOR UPDATE;
 IF t.id IS NULL OR (NOT _admin AND t.user_id<>auth.uid()) THEN RAISE EXCEPTION 'Thread not available'; END IF;
 IF _status IS NOT NULL AND (_status NOT IN ('open','answered','closed') OR (NOT _admin AND _status<>'closed')) THEN RAISE EXCEPTION 'Invalid status'; END IF;
 IF _tag IS NOT NULL AND (NOT _admin OR _tag NOT IN ('onboarding','connect','models','billing','chat','other')) THEN RAISE EXCEPTION 'Invalid tag'; END IF;
 UPDATE public.support_threads SET status=coalesce(_status,status),tag=coalesce(_tag,tag),closed_at=CASE WHEN _status='closed' THEN now() WHEN _status IS NOT NULL THEN NULL ELSE closed_at END,
 user_read_at=CASE WHEN _read AND NOT _admin THEN now() ELSE user_read_at END,
 admin_read_at=CASE WHEN _read AND _admin THEN now() ELSE admin_read_at END WHERE id=t.id;
END $$;
REVOKE ALL ON FUNCTION public.support_manage(uuid,text,text,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_manage(uuid,text,text,boolean,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.support_claim_prompt() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 INSERT INTO public.support_prompt_days(user_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.support_claim_prompt() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_claim_prompt() TO authenticated;
CREATE OR REPLACE FUNCTION public.support_stats() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('open',(SELECT count(*) FROM public.support_threads WHERE status='open'),
 'waiting',coalesce((SELECT jsonb_agg(jsonb_build_object('thread_id',left(id::text,8),'waiting_minutes',greatest(0,floor(extract(epoch FROM(now()-last_user_message_at))/60)),'tag',tag) ORDER BY last_user_message_at) FROM public.support_threads WHERE status<>'closed' AND last_user_message_at IS NOT NULL AND (last_admin_message_at IS NULL OR last_user_message_at>last_admin_message_at)),'[]'::jsonb),
 'median_first_response_minutes_30d',(SELECT round(percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM(first_admin-first_user))/60)::numeric,1) FROM (SELECT t.id,min(m.created_at) FILTER(WHERE m.sender='user') first_user,min(m.created_at) FILTER(WHERE m.sender='admin') first_admin FROM public.support_threads t JOIN public.support_messages m ON m.thread_id=t.id WHERE t.created_at>=now()-interval '30 days' GROUP BY t.id) r WHERE first_admin>=first_user))
$$;
REVOKE ALL ON FUNCTION public.support_stats() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.support_stats() TO service_role;
CREATE OR REPLACE FUNCTION public.support_diagnostics() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); key_at timestamptz; success boolean;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 SELECT min(created_at) INTO key_at FROM public.api_keys WHERE user_id=uid AND NOT internal;
 SELECT EXISTS(SELECT 1 FROM public.customer_garage_model_stats_hourly s JOIN public.api_keys k ON encode(sha256(convert_to(k.litellm_token,'UTF8')),'hex')=ANY(s.api_keys) WHERE k.user_id=uid AND NOT k.internal AND s.requests>s.failures) INTO success;
 RETURN jsonb_build_object('key_created_at',key_at,'has_successful_request',success,
 'events',coalesce((SELECT jsonb_agg(jsonb_build_object('garage_id',e.garage_id,'step',e.step,'status',e.status,'created_at',e.created_at)) FROM (SELECT e.* FROM public.onboarding_events e JOIN public.garages g ON g.id=e.garage_id WHERE g.operator_id=uid ORDER BY e.created_at DESC LIMIT 200) e),'[]'::jsonb),
 'failed_model',EXISTS(SELECT 1 FROM public.garage_models m JOIN public.garages g ON g.id=m.garage_id WHERE g.operator_id=uid AND m.status='failed' AND EXISTS(SELECT 1 FROM public.garage_model_tests t WHERE t.garage_id=g.id AND t.model=m.model AND NOT t.passed AND NOT t.inconclusive)));
END $$;
REVOKE ALL ON FUNCTION public.support_diagnostics() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_diagnostics() TO authenticated;
CREATE OR REPLACE FUNCTION public.support_founder_avatar() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT CASE WHEN auth.uid() IS NOT NULL THEN coalesce(u.raw_user_meta_data->>'avatar_url',u.raw_user_meta_data->>'picture') END FROM auth.users u WHERE u.id='9ca90269-8ab4-4a16-951f-555f32bf159c' AND public.has_role(u.id,'admin') $$;
REVOKE ALL ON FUNCTION public.support_founder_avatar() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_founder_avatar() TO authenticated;
CREATE OR REPLACE FUNCTION public.prune_closed_support() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n bigint; BEGIN DELETE FROM public.support_threads WHERE status='closed' AND closed_at<now()-interval '12 months'; GET DIAGNOSTICS n=ROW_COUNT; DELETE FROM public.support_prompt_days WHERE day<(now() AT TIME ZONE 'UTC')::date-2; RETURN n; END $$;
REVOKE ALL ON FUNCTION public.prune_closed_support() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prune_closed_support() TO service_role;