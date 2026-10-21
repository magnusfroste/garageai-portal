CREATE POLICY "Signed-in users can read support availability" ON public.admin_settings FOR SELECT TO authenticated USING(key='support_chat');
CREATE OR REPLACE FUNCTION public.support_availability() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN s->>'mode'='off' THEN jsonb_build_object('mode','off','away_until',null) WHEN s->>'mode'='away' AND (s->>'away_until')::date >= (now() AT TIME ZONE 'UTC')::date THEN jsonb_build_object('mode','away','away_until',s->>'away_until') ELSE jsonb_build_object('mode','on','away_until',null) END FROM (SELECT coalesce((SELECT value FROM public.admin_settings WHERE key='support_chat'),'{"mode":"on","away_until":null}'::jsonb) s) q
$$;
REVOKE ALL ON FUNCTION public.support_availability() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_availability() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.validate_support_setting() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.key='support_chat' THEN
  IF jsonb_typeof(NEW.value)<>'object' OR coalesce(NEW.value->>'mode','') NOT IN ('on','away','off') THEN RAISE EXCEPTION 'Invalid support mode'; END IF;
  IF NEW.value->>'mode'='away' THEN
   IF coalesce(NEW.value->>'away_until','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Choose an away date'; END IF;
   PERFORM (NEW.value->>'away_until')::date;
  END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER validate_support_setting BEFORE INSERT OR UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION public.validate_support_setting();
CREATE OR REPLACE FUNCTION public.set_support_availability(_mode text,_away_until date DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 IF _mode NOT IN ('on','away','off') THEN RAISE EXCEPTION 'Invalid support mode'; END IF;
 IF _mode='away' AND (_away_until IS NULL OR _away_until<(now() AT TIME ZONE 'UTC')::date) THEN RAISE EXCEPTION 'Choose today or a future date'; END IF;
 INSERT INTO public.admin_settings(key,value,updated_at) VALUES('support_chat',jsonb_build_object('mode',_mode,'away_until',CASE WHEN _mode='away' THEN _away_until ELSE NULL END),now()) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;
END $$;
REVOKE ALL ON FUNCTION public.set_support_availability(text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_support_availability(text,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_support_off() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF public.support_availability()->>'mode'='off' AND (TG_TABLE_NAME='support_threads' OR NEW.sender='user') THEN RAISE EXCEPTION 'Support chat is currently off. You can still read existing replies from Account.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_support_thread_off BEFORE INSERT ON public.support_threads FOR EACH ROW EXECUTE FUNCTION public.guard_support_off();
CREATE TRIGGER guard_support_message_off BEFORE INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.guard_support_off();
CREATE OR REPLACE FUNCTION public.support_claim_prompt() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR public.support_availability()->>'mode'<>'on' THEN RETURN false; END IF;
 INSERT INTO public.support_prompt_days(user_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING; RETURN FOUND;
END $$;
CREATE OR REPLACE FUNCTION public.support_stats() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.support_availability() || jsonb_build_object('open',(SELECT count(*) FROM public.support_threads WHERE status='open'),
 'waiting',coalesce((SELECT jsonb_agg(jsonb_build_object('thread_id',left(id::text,8),'waiting_minutes',greatest(0,floor(extract(epoch FROM(now()-last_user_message_at))/60)),'tag',tag) ORDER BY last_user_message_at) FROM public.support_threads WHERE status<>'closed' AND last_user_message_at IS NOT NULL AND (last_admin_message_at IS NULL OR last_user_message_at>last_admin_message_at)),'[]'::jsonb),
 'median_first_response_minutes_30d',(SELECT round(percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM(first_admin-first_user))/60)::numeric,1) FROM (SELECT t.id,min(m.created_at) FILTER(WHERE m.sender='user') first_user,min(m.created_at) FILTER(WHERE m.sender='admin') first_admin FROM public.support_threads t JOIN public.support_messages m ON m.thread_id=t.id WHERE t.created_at>=now()-interval '30 days' GROUP BY t.id) r WHERE first_admin>=first_user))
$$;