-- GarageAI portal: live database schema snapshot, read from the Lovable Supabase
-- project on 2026-11-26 with SELECT queries (db/dump-schema.sql), PostgreSQL 17.6.
-- Schema only, no data. Not a migration: never place it in supabase/ or drizzle/.
-- Restores onto Supabase (needs schemas auth/storage/cron/net/vault, roles anon/
-- authenticated/service_role); db/README.md says how it was tested.
-- Regenerate: run db/dump-schema.sql, then python3 db/build_schema.py result.json db/schema.sql

SET check_function_bodies = false;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ======================================================================
-- Types (1)
-- ======================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- ======================================================================
-- Sequences (1)
-- ======================================================================
CREATE SEQUENCE IF NOT EXISTS public.garage_country_history_id_seq;

-- ======================================================================
-- Functions (before tables, bodies not checked, as pg_dump does) (90)
-- ======================================================================
CREATE OR REPLACE FUNCTION public.accept_account_terms(_version text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
 IF _version IS DISTINCT FROM public.account_terms_version() THEN RAISE EXCEPTION 'Current terms version required' USING ERRCODE = '22023'; END IF;
 UPDATE public.profiles SET terms_version = public.account_terms_version(), terms_accepted_at = now() WHERE id = auth.uid() AND terms_version IS DISTINCT FROM public.account_terms_version();
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN RAISE EXCEPTION 'Profile not found'; END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.account_terms_valid(_version text, _at timestamp with time zone DEFAULT now())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT coalesce(_version = public.account_terms_version() OR (_version = '2026-10-17' AND _at < timestamptz '2026-11-09 00:00:00+00'), false) $function$
;

CREATE OR REPLACE FUNCTION public.account_terms_version()
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ SELECT '2026-10-25'::text $function$
;

CREATE OR REPLACE FUNCTION public.aggregate_garage_energy()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE item jsonb; d date := (NEW.at AT TIME ZONE 'UTC')::date; s text := coalesce(NEW.source,'');
BEGIN
 INSERT INTO public.garage_energy_daily(garage_id,model,day,source,wh,busy_wh,out_tokens,in_tokens,efficiency_wh,efficiency_tokens)
 VALUES(NEW.garage_id,'',d,s,NEW.wh,NEW.busy_wh,NEW.out_tokens,NEW.in_tokens,
 CASE WHEN NEW.out_tokens IS NOT NULL AND NEW.busy_wh>0 THEN NEW.busy_wh ELSE 0 END,
 CASE WHEN NEW.out_tokens IS NOT NULL AND NEW.busy_wh>0 THEN NEW.out_tokens ELSE 0 END)
 ON CONFLICT(garage_id,model,day,source) DO UPDATE SET
 wh=CASE WHEN EXCLUDED.wh IS NULL THEN garage_energy_daily.wh ELSE coalesce(garage_energy_daily.wh,0)+EXCLUDED.wh END,
 busy_wh=CASE WHEN EXCLUDED.busy_wh IS NULL THEN garage_energy_daily.busy_wh ELSE coalesce(garage_energy_daily.busy_wh,0)+EXCLUDED.busy_wh END,
 out_tokens=CASE WHEN EXCLUDED.out_tokens IS NULL THEN garage_energy_daily.out_tokens ELSE coalesce(garage_energy_daily.out_tokens,0)+EXCLUDED.out_tokens END,
 in_tokens=CASE WHEN EXCLUDED.in_tokens IS NULL THEN garage_energy_daily.in_tokens ELSE coalesce(garage_energy_daily.in_tokens,0)+EXCLUDED.in_tokens END,
 efficiency_wh=garage_energy_daily.efficiency_wh+EXCLUDED.efficiency_wh,
 efficiency_tokens=garage_energy_daily.efficiency_tokens+EXCLUDED.efficiency_tokens;
 FOR item IN SELECT value FROM jsonb_array_elements(NEW.models) LOOP
 INSERT INTO public.garage_energy_daily(garage_id,model,day,source,busy_wh,out_tokens,efficiency_wh,efficiency_tokens)
 VALUES(NEW.garage_id,item->>'model',d,s,(item->>'busy_wh')::numeric,(item->>'out_tokens')::bigint,
 CASE WHEN item->>'out_tokens' IS NOT NULL AND (item->>'busy_wh')::numeric>0 THEN (item->>'busy_wh')::numeric ELSE 0 END,
 CASE WHEN item->>'out_tokens' IS NOT NULL AND (item->>'busy_wh')::numeric>0 THEN (item->>'out_tokens')::bigint ELSE 0 END)
 ON CONFLICT(garage_id,model,day,source) DO UPDATE SET
 busy_wh=CASE WHEN EXCLUDED.busy_wh IS NULL THEN garage_energy_daily.busy_wh ELSE coalesce(garage_energy_daily.busy_wh,0)+EXCLUDED.busy_wh END,
 out_tokens=CASE WHEN EXCLUDED.out_tokens IS NULL THEN garage_energy_daily.out_tokens ELSE coalesce(garage_energy_daily.out_tokens,0)+EXCLUDED.out_tokens END,
 efficiency_wh=garage_energy_daily.efficiency_wh+EXCLUDED.efficiency_wh,
 efficiency_tokens=garage_energy_daily.efficiency_tokens+EXCLUDED.efficiency_tokens;
 END LOOP;
 RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.apply_credit_reversal(_event_id text, _session_id text, _charge_id text, _charged_minor bigint, _refunded_minor bigint, _disputed_minor bigint, _reason text)
 RETURNS TABLE(user_id uuid, credits_delta numeric, already_processed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE purchase public.credit_transactions; state public.credit_payment_reversals; target numeric; delta numeric;
BEGIN
 IF coalesce(_event_id,'')='' OR coalesce(_charge_id,'')='' OR _charged_minor<=0 OR _refunded_minor<0 OR (_disputed_minor IS NOT NULL AND _disputed_minor<0) OR _reason NOT IN ('refund','dispute_created','dispute_won','dispute_closed') THEN RAISE EXCEPTION 'Invalid reversal'; END IF;
 SELECT * INTO purchase FROM public.credit_transactions WHERE stripe_session_id=_session_id FOR UPDATE;
 IF purchase.id IS NULL THEN RAISE EXCEPTION 'Original checkout grant not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.credit_transactions WHERE stripe_event_id=_event_id) THEN
 RETURN QUERY SELECT purchase.user_id,0::numeric,true; RETURN;
 END IF;
 INSERT INTO public.credit_payment_reversals(session_id,charge_id,charged_minor) VALUES(_session_id,_charge_id,_charged_minor) ON CONFLICT(session_id) DO NOTHING;
 SELECT * INTO state FROM public.credit_payment_reversals WHERE session_id=_session_id FOR UPDATE;
 IF state.charge_id<>_charge_id OR state.charged_minor<>_charged_minor THEN RAISE EXCEPTION 'Charge does not match original reversal'; END IF;
 target:=round(purchase.credits_added * least(_charged_minor,greatest(state.refunded_minor,_refunded_minor)+coalesce(_disputed_minor,state.disputed_minor))::numeric/_charged_minor,8);
 delta:=state.reversed_credits-target;
 INSERT INTO public.credit_transactions(user_id,amount_usd,credits_added,stripe_event_id,reason,original_session_id,stripe_charge_id)
 VALUES(purchase.user_id,delta,delta,_event_id,_reason,_session_id,_charge_id);
 UPDATE public.profiles SET purchased_credits_usd=purchased_credits_usd+delta WHERE id=purchase.user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
 UPDATE public.credit_payment_reversals SET refunded_minor=greatest(state.refunded_minor,_refunded_minor),disputed_minor=coalesce(_disputed_minor,state.disputed_minor),reversed_credits=target,updated_at=now() WHERE session_id=_session_id;
 RETURN QUERY SELECT purchase.user_id,delta,false;
END $function$
;

CREATE OR REPLACE FUNCTION public.apply_managed_model_cancel(_garage_id uuid, _model text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cur record;
BEGIN
  SELECT * INTO cur FROM garage_managed_models WHERE garage_id = _garage_id AND model = _model FOR UPDATE;
  IF cur IS NULL THEN RETURN; END IF;
  IF cur.action = 'remove' AND cur.status <> 'removed' THEN
    UPDATE garage_managed_models SET action = 'pull', status = 'ready', error = NULL WHERE garage_id = _garage_id AND model = _model;
  ELSIF cur.action = 'pull' AND cur.status IN ('downloading', 'ready') THEN
    -- Bridge already fetched (or is fetching): cancel becomes a remove request, so nothing is orphaned.
    UPDATE garage_managed_models SET action = 'remove', status = 'wanted', error = NULL, requested_at = now(), reported_at = NULL WHERE garage_id = _garage_id AND model = _model;
  ELSIF cur.action = 'pull' THEN
    DELETE FROM garage_managed_models WHERE garage_id = _garage_id AND model = _model;
  END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.apply_managed_model_request(_garage_id uuid, _model text, _action text, _by text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE g record; cur record;
BEGIN
  SELECT * INTO g FROM garages WHERE id = _garage_id;
  IF g IS NULL THEN RAISE EXCEPTION 'garage not found'; END IF;
  IF g.runtime IS DISTINCT FROM 'ollama' THEN RAISE EXCEPTION 'fetching models is available for Ollama'; END IF;
  IF _model IS NULL OR length(_model) > 200 OR _model !~ '^[A-Za-z0-9._:/-]+$' THEN RAISE EXCEPTION 'invalid model'; END IF;
  SELECT * INTO cur FROM garage_managed_models WHERE garage_id = _garage_id AND model = _model;
  IF _action = 'pull' THEN
    INSERT INTO garage_managed_models (garage_id, model, action, "by", status, requested_at)
    VALUES (_garage_id, _model, 'pull', _by, 'wanted', now())
    ON CONFLICT (garage_id, model) DO UPDATE SET action = 'pull', "by" = _by, status = 'wanted', completed_mb = NULL, total_mb = NULL, error = NULL, requested_at = now(), reported_at = NULL;
  ELSIF _action = 'remove' THEN
    IF cur IS NULL OR cur.action <> 'pull' OR cur.status <> 'ready' THEN RAISE EXCEPTION 'only models Bridge fetched can be removed'; END IF;
    UPDATE garage_managed_models SET action = 'remove', "by" = _by, status = 'wanted', error = NULL, requested_at = now(), reported_at = NULL WHERE garage_id = _garage_id AND model = _model;
  ELSE RAISE EXCEPTION 'invalid action'; END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.apply_smart_model_change(_garage_id uuid, _model text, _action text, _reason jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE g garages; event_id uuid; BEGIN
SELECT * INTO g FROM garages WHERE id=_garage_id FOR UPDATE;
IF g.id IS NULL OR NOT g.smart OR g.disabled OR g.paused_at IS NOT NULL OR g.created_at>now()-interval '24 hours' OR g.runtime IS DISTINCT FROM 'ollama' OR g.operator_id IS NULL THEN RETURN NULL; END IF;
IF EXISTS(SELECT 1 FROM garage_smart_events WHERE garage_id=g.id AND day=(now() AT TIME ZONE 'UTC')::date) OR EXISTS(SELECT 1 FROM garage_managed_models WHERE garage_id=g.id AND ((action='pull' AND status<>'ready') OR (action='remove' AND status<>'removed'))) THEN RETURN NULL; END IF;
IF _action='remove' AND NOT EXISTS(SELECT 1 FROM garage_managed_models WHERE garage_id=g.id AND model=_model AND "by"='garageai' AND action='pull' AND status='ready' AND requested_at<=now()-interval '14 days') THEN RETURN NULL; END IF;
IF _action='pull' AND (EXISTS(SELECT 1 FROM garage_models WHERE garage_id=g.id AND model=_model AND installed) OR EXISTS(SELECT 1 FROM garage_managed_models WHERE garage_id=g.id AND model=_model AND status<>'removed')) THEN RETURN NULL; END IF;
PERFORM apply_managed_model_request(g.id,_model,_action,'garageai');
INSERT INTO garage_smart_events(garage_id,operator_id,model,action,reason) VALUES(g.id,g.operator_id,_model,_action,_reason) RETURNING id INTO event_id; RETURN event_id; END $function$
;

CREATE OR REPLACE FUNCTION public.cancel_managed_model(_garage_id uuid, _model text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM garages WHERE id = _garage_id AND (operator_id = auth.uid() OR has_role(auth.uid(), 'admin'))) THEN RAISE EXCEPTION 'not your garage'; END IF;
  PERFORM apply_managed_model_cancel(_garage_id, _model);
END $function$
;

CREATE OR REPLACE FUNCTION public.claim_checkout_credits(p_session_id text, p_user_id uuid, p_credits numeric)
 RETURNS TABLE(credits_added numeric, already_processed boolean, total_budget numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count integer;
BEGIN
  IF p_session_id IS NULL OR p_session_id = '' OR p_user_id IS NULL OR p_credits IS NULL OR p_credits <= 0 THEN
    RAISE EXCEPTION 'invalid credit claim';
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount_usd, credits_added, stripe_session_id)
  VALUES (p_user_id, p_credits, p_credits, p_session_id)
  ON CONFLICT (stripe_session_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 1 THEN
    UPDATE public.profiles
    SET purchased_credits_usd = COALESCE(purchased_credits_usd, 0) + p_credits
    WHERE id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
  END IF;

  RETURN QUERY
  SELECT CASE WHEN inserted_count = 1 THEN p_credits ELSE 0::numeric END,
         inserted_count = 0,
         COALESCE(p.starting_credit_usd, 0) + COALESCE(p.purchased_credits_usd, 0)
  FROM public.profiles p WHERE p.id = p_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.dismiss_account_terms_notice(_version text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
 IF _version IS DISTINCT FROM public.account_terms_version() THEN RAISE EXCEPTION 'Current terms version required' USING ERRCODE = '22023'; END IF;
 UPDATE public.profiles SET terms_notice_dismissed_version = _version WHERE id = auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.ensure_single_default_model()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.curated_models 
    SET is_default = false 
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.event_mail_candidates(_mode text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, email text, template_key text, event_ref text, key_hint text, garage_name text, days_offline integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE m text; delay_minutes integer; BEGIN
IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
SELECT coalesce(_mode,value->>'mode','off'),coalesce((value->>'test_delay_minutes')::integer,10) INTO m,delay_minutes FROM admin_settings WHERE key='event_mail';
IF m IS NULL OR m='off' THEN RETURN; END IF;
IF m NOT IN ('test','on') THEN RAISE EXCEPTION 'Invalid mail mode'; END IF;
RETURN QUERY WITH accounts AS(SELECT p.* FROM profiles p WHERE m='on' OR p.mail_test),first_keys AS(SELECT DISTINCT ON(k.user_id) k.user_id,k.created_at,coalesce(nullif(k.key_last4,''),right(k.key_value,4)) hint FROM api_keys k JOIN accounts p ON p.id=k.user_id WHERE NOT k.internal ORDER BY k.user_id,k.created_at),uses AS(SELECT u.user_id,min(u.at) at FROM(SELECT r.user_id,r.first_request_at at FROM buyer_first_requests r UNION ALL SELECT c.user_id,c.created_at FROM chat_conversations c UNION ALL SELECT k.user_id,h.hour FROM api_keys k JOIN customer_garage_model_stats_hourly h ON encode(extensions.digest(k.litellm_token,'sha256'),'hex')=ANY(h.api_keys) WHERE NOT k.internal AND h.requests>h.failures)u GROUP BY u.user_id)
SELECT p.id,p.email,'first_request_nudge'::text,'first-key'::text,k.hint,''::text,0 FROM accounts p JOIN first_keys k ON k.user_id=p.id LEFT JOIN uses u ON u.user_id=p.id WHERE u.at IS NULL AND k.created_at<=now()-CASE WHEN m='test' THEN make_interval(mins=>delay_minutes) ELSE interval '2 days' END AND EXISTS(SELECT 1 FROM mail_templates t WHERE t.key='first_request_nudge' AND t.enabled)
UNION ALL SELECT p.id,p.email,'connect_garage_nudge','first-goal','', '',0 FROM accounts p WHERE p.first_goal IN ('share','own_machine') AND p.first_goal_at<=now()-CASE WHEN m='test' THEN make_interval(mins=>delay_minutes) ELSE interval '3 days' END AND NOT EXISTS(SELECT 1 FROM garages g WHERE g.operator_id=p.id) AND EXISTS(SELECT 1 FROM mail_templates t WHERE t.key='connect_garage_nudge' AND t.enabled)
UNION ALL SELECT p.id,p.email,'garage_offline',g.id::text||':'||to_char(g.last_heartbeat_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'),'',coalesce(nullif(g.display_name,''),g.name),greatest(0,floor(extract(epoch FROM now()-g.last_heartbeat_at)/86400)::integer) FROM accounts p JOIN garages g ON g.operator_id=p.id WHERE g.connection_type<>'endpoint' AND g.last_heartbeat_at IS NOT NULL AND g.paused_at IS NULL AND NOT g.paused_by_admin AND g.last_heartbeat_at<=now()-CASE WHEN m='test' THEN make_interval(mins=>delay_minutes) ELSE interval '3 days' END AND EXISTS(SELECT 1 FROM mail_templates t WHERE t.key='garage_offline' AND t.enabled);
END $function$
;

CREATE OR REPLACE FUNCTION public.event_mail_claim(_user_id uuid, _template text, _ref text, _manual boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE p profiles;s mail_delivery_state;cfg jsonb;m text;slot text;lid uuid;skip text;recent timestamptz[]; BEGIN
SELECT * INTO p FROM profiles WHERE id=_user_id FOR UPDATE; IF p.id IS NULL THEN RETURN NULL; END IF;
SELECT value INTO cfg FROM admin_settings WHERE key='event_mail'; m:=coalesce(cfg->>'mode','off');
IF NOT _manual AND (m='off' OR (m='test' AND NOT p.mail_test)) THEN RETURN NULL; END IF;
IF NOT _manual AND NOT EXISTS(SELECT 1 FROM public.event_mail_candidates(m) c WHERE c.user_id=_user_id AND c.template_key=_template AND c.event_ref=_ref) THEN RETURN NULL; END IF;
IF p.mail_opt_out_at IS NOT NULL THEN skip:='skipped_opt_out'; END IF;
INSERT INTO mail_delivery_state(user_id) VALUES(_user_id) ON CONFLICT DO NOTHING;
SELECT * INTO s FROM mail_delivery_state WHERE user_id=_user_id FOR UPDATE;
slot:=_template||CASE WHEN _template='garage_offline' THEN ':'||split_part(_ref,':',1) ELSE '' END;
IF NOT _manual AND (s.sent_events->>slot=_ref OR EXISTS(SELECT 1 FROM mail_log WHERE user_id=_user_id AND template_key=_template AND event_ref=_ref AND status='sent')) THEN RETURN NULL; END IF;
SELECT coalesce(array_agg(x),'{}'::timestamptz[]) INTO recent FROM unnest(s.recent_sent)x WHERE x>=now()-interval '7 days';
IF NOT _manual AND skip IS NULL AND (s.total_sent>=coalesce((cfg->>'max_total')::integer,3) OR cardinality(recent)>=coalesce((cfg->>'max_per_week')::integer,1)) THEN skip:='skipped_cap'; END IF;
IF _manual THEN DELETE FROM mail_log WHERE user_id=_user_id AND template_key=_template AND event_ref='manual-test' AND status='sent'; END IF;
INSERT INTO mail_log(user_id,template_key,event_ref,mode,status,error) VALUES(_user_id,_template,_ref,m,coalesce(skip,'failed'),CASE WHEN skip IS NULL THEN 'delivery pending' ELSE NULL END) RETURNING id INTO lid;
IF skip IS NULL AND NOT _manual THEN UPDATE mail_delivery_state SET total_sent=s.total_sent+1,recent_sent=array_append(recent,now()),sent_events=jsonb_set(s.sent_events,ARRAY[slot],to_jsonb(_ref)) WHERE user_id=_user_id; END IF;
RETURN jsonb_build_object('log_id',lid,'status',coalesce(skip,'ready'),'language',p.mail_language);
END $function$
;

CREATE OR REPLACE FUNCTION public.event_mail_eligible_counts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF; RETURN (WITH candidates AS(SELECT c.* FROM public.event_mail_candidates('on')c),cfg AS(SELECT value FROM admin_settings WHERE key='event_mail'),eligible AS(SELECT c.* FROM candidates c JOIN profiles p ON p.id=c.user_id LEFT JOIN mail_delivery_state s ON s.user_id=c.user_id CROSS JOIN cfg WHERE p.mail_opt_out_at IS NULL AND coalesce(s.total_sent,0)<coalesce((cfg.value->>'max_total')::integer,3) AND (SELECT count(*) FROM unnest(s.recent_sent)x WHERE x>=now()-interval '7 days')<coalesce((cfg.value->>'max_per_week')::integer,1) AND (s.sent_events->>(c.template_key||CASE WHEN c.template_key='garage_offline' THEN ':'||split_part(c.event_ref,':',1) ELSE '' END)) IS DISTINCT FROM c.event_ref) SELECT jsonb_build_object('accounts',(SELECT count(DISTINCT user_id) FROM eligible),'by_rule',(SELECT jsonb_object_agg(t.key,jsonb_build_object('matching_accounts',(SELECT count(DISTINCT c.user_id) FROM candidates c WHERE c.template_key=t.key),'eligible_accounts',(SELECT count(DISTINCT c.user_id) FROM eligible c WHERE c.template_key=t.key))) FROM mail_templates t))); END $function$
;

CREATE OR REPLACE FUNCTION public.event_mail_finish(_log_id uuid, _sent boolean, _provider_id text DEFAULT NULL::text, _error text DEFAULT NULL::text, _definite_failure boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE l mail_log;slot text; BEGIN
SELECT * INTO l FROM mail_log WHERE id=_log_id FOR UPDATE; IF l.id IS NULL OR l.status<>'failed' OR l.error<>'delivery pending' THEN RETURN; END IF;
UPDATE mail_log SET status=CASE WHEN _sent THEN 'sent' ELSE 'failed' END,provider_message_id=_provider_id,error=CASE WHEN _sent THEN NULL ELSE left(_error,300) END WHERE id=_log_id;
IF NOT _sent AND _definite_failure AND l.event_ref<>'manual-test' THEN slot:=l.template_key||CASE WHEN l.template_key='garage_offline' THEN ':'||split_part(l.event_ref,':',1) ELSE '' END; UPDATE mail_delivery_state SET total_sent=greatest(0,total_sent-1),recent_sent=array_remove(recent_sent,l.created_at),sent_events=sent_events-slot WHERE user_id=l.user_id AND sent_events->>slot=l.event_ref; END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.event_mail_lock(_owner uuid, _release boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE got boolean; BEGIN IF _release THEN DELETE FROM public.mail_worker_lock WHERE singleton AND owner=_owner; RETURN true; END IF; INSERT INTO public.mail_worker_lock(singleton,owner,until_at) VALUES(true,_owner,now()+interval '10 minutes') ON CONFLICT(singleton) DO UPDATE SET owner=excluded.owner,until_at=excluded.until_at WHERE mail_worker_lock.until_at<now() RETURNING true INTO got; RETURN coalesce(got,false); END $function$
;

CREATE OR REPLACE FUNCTION public.event_mail_prune()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE n bigint; BEGIN DELETE FROM mail_log WHERE created_at<now()-interval '12 months'; GET DIAGNOSTICS n=ROW_COUNT; RETURN n; END $function$
;

CREATE OR REPLACE FUNCTION public.event_mail_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF; RETURN jsonb_build_object('mode',coalesce((SELECT value->>'mode' FROM admin_settings WHERE key='event_mail'),'off'),'sent_7d',(SELECT count(*) FROM mail_log WHERE status='sent' AND created_at>=now()-interval '7 days'),'failed_7d',(SELECT count(*) FROM mail_log WHERE status='failed' AND created_at>=now()-interval '7 days'),'by_template',(SELECT coalesce(jsonb_object_agg(t.key,jsonb_build_object('sent_30d',(SELECT count(*) FROM mail_log l WHERE l.template_key=t.key AND l.status='sent' AND l.created_at>=now()-interval '30 days'))),'{}'::jsonb) FROM mail_templates t),'opted_out',(SELECT count(*) FROM profiles WHERE mail_opt_out_at IS NOT NULL)); END $function$
;

CREATE OR REPLACE FUNCTION public.fill_ledger_garage_name()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.garage_name IS NULL THEN SELECT name INTO NEW.garage_name FROM public.garages WHERE id = NEW.garage_id; END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.garage_daily_tokens(_names text[])
 RETURNS TABLE(garage_name text, day date, tokens bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT g.name, h.hour::date, sum(h.completion_tokens)::bigint
  FROM public.garages g
  JOIN public.customer_garage_request_stats_hourly h ON h.garage_id = g.id
  WHERE g.visibility = 'market' AND g.name = ANY(_names) AND h.hour >= now() - interval '30 days'
  GROUP BY g.name, h.hour::date
$function$
;

CREATE OR REPLACE FUNCTION public.garage_earning_buckets(_garage_id uuid, _from timestamp with time zone, _to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT jsonb_build_object(
    'payable_spend_usd', coalesce(sum(payable_spend_usd),0), 'trial_spend_usd', coalesce(sum(trial_spend_usd),0), 'own_spend_usd', coalesce(sum(own_spend_usd),0),
    'payable_requests', coalesce(sum(payable_requests),0), 'trial_requests', coalesce(sum(trial_requests),0), 'own_requests', coalesce(sum(own_requests),0),
    'total_spend_usd', coalesce(sum(spend_usd),0), 'requests', coalesce(sum(requests),0),
    'buyer_users', (SELECT count(DISTINCT u) FROM garage_request_stats_hourly h2, unnest(h2.buyer_users) u WHERE h2.garage_id=_garage_id AND h2.hour>=_from AND h2.hour<_to))
  FROM garage_request_stats_hourly WHERE garage_id=_garage_id AND hour>=_from AND hour<_to);
END $function$
;

CREATE OR REPLACE FUNCTION public.garage_energy_summary(_garage_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 WITH allowed AS (SELECT id FROM public.garages WHERE id=_garage_id AND (operator_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR auth.role()='service_role')),
 today AS (SELECT sum(wh) wh,sum(busy_wh) busy_wh,sum(efficiency_tokens)/nullif(sum(efficiency_wh)/1000,0) tokens_per_kwh,array_agg(DISTINCT nullif(source,'')) sources FROM public.garage_energy_daily WHERE garage_id IN (SELECT id FROM allowed) AND model='' AND day=(now() AT TIME ZONE 'UTC')::date),
 models AS (SELECT d.model,coalesce(gm.canonical_model,public.normalise_model_id(d.model)) canonical_model,sum(d.efficiency_tokens)/nullif(sum(d.efficiency_wh)/1000,0) tokens_per_kwh FROM public.garage_energy_daily d LEFT JOIN public.garage_models gm ON gm.garage_id=d.garage_id AND gm.model=d.model WHERE d.garage_id IN (SELECT id FROM allowed) AND d.model<>'' AND d.day BETWEEN (now() AT TIME ZONE 'UTC')::date-6 AND (now() AT TIME ZONE 'UTC')::date GROUP BY d.model,gm.canonical_model)
 SELECT CASE WHEN EXISTS(SELECT 1 FROM allowed) THEN jsonb_build_object('today',(SELECT to_jsonb(today) FROM today),'models',coalesce((SELECT jsonb_agg(to_jsonb(models)) FROM models),'[]'::jsonb)) ELSE NULL END
$function$
;

CREATE OR REPLACE FUNCTION public.garage_models_canonical()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
END $function$
;

CREATE OR REPLACE FUNCTION public.garage_offline_periods(_name text, _limit integer DEFAULT 5)
 RETURNS TABLE(started_at timestamp with time zone, ended_at timestamp with time zone, duration_seconds numeric, reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH g AS (
    SELECT id FROM public.garages
    WHERE name = _name AND (operator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ),
  s AS (
    SELECT sampled_at, online, reason,
      row_number() OVER (ORDER BY sampled_at) - row_number() OVER (PARTITION BY online ORDER BY sampled_at) AS grp
    FROM public.garage_status_samples WHERE garage_id = (SELECT id FROM g) AND sampled_at >= now() - interval '30 days'
  ),
  islands AS (
    SELECT grp, min(sampled_at) AS started_at, max(sampled_at) AS last_at,
      mode() WITHIN GROUP (ORDER BY reason) AS reason
    FROM s WHERE NOT online GROUP BY grp
  )
  SELECT i.started_at,
    (SELECT min(sampled_at) FROM s WHERE s.online AND s.sampled_at > i.last_at) AS ended_at,
    extract(epoch FROM coalesce((SELECT min(sampled_at) FROM s WHERE s.online AND s.sampled_at > i.last_at), now()) - i.started_at)::numeric,
    i.reason
  FROM islands i
  ORDER BY i.started_at DESC
  LIMIT greatest(1, least(_limit, 50))
$function$
;

CREATE OR REPLACE FUNCTION public.garage_profile(_name text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'name', g.name,
    'display_name', coalesce(nullif(g.display_name, ''), g.name),
    'runtime', g.runtime,
    'models', (SELECT coalesce(jsonb_agg(DISTINCT gm.canonical_model), '[]'::jsonb) FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed AND gm.paused_at IS NULL),
    'status', g.status,
    'disabled', g.disabled,
    'paused', g.paused_at IS NOT NULL,
    'online', g.paused_at IS NULL AND g.status = 'online' AND g.runtime_ok IS DISTINCT FROM false AND EXISTS (SELECT 1 FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed AND gm.paused_at IS NULL AND gm.status = 'live'),
    'active_since', coalesce((SELECT ss.first_sampled_at FROM public.garage_status_summary ss WHERE ss.garage_id = g.id), g.created_at),
    'total_tokens', (SELECT coalesce(sum(completion_tokens), 0) FROM public.customer_garage_request_stats_hourly WHERE garage_id = g.id),
    'daily', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'online_pct', d.pct, 'samples', d.n) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT days.day::date AS day, round(100 * avg(CASE WHEN s.online THEN 1.0 ELSE 0.0 END), 1) AS pct, count(s.id) AS n
        FROM generate_series((now() - interval '29 days')::date, now()::date, interval '1 day') AS days(day)
        LEFT JOIN public.garage_status_samples s ON s.garage_id = g.id AND s.sampled_at::date = days.day::date
        GROUP BY days.day
      ) d
    )
  ) FROM public.garages g
  WHERE g.name = _name AND NOT g.disabled AND g.visibility = 'market' AND (
    EXISTS (SELECT 1 FROM public.garage_status_summary ss WHERE ss.garage_id = g.id AND ss.first_online_at IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.garage_public_energy(_model text)
 RETURNS TABLE(garage_name text, tokens_per_kwh numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT g.name,sum(d.efficiency_tokens)/nullif(sum(d.efficiency_wh)/1000,0)
 FROM public.garage_energy_daily d JOIN public.garages g ON g.id=d.garage_id JOIN public.garage_models gm ON gm.garage_id=d.garage_id AND gm.model=d.model
 WHERE d.model<>'' AND gm.canonical_model=_model AND gm.offered AND gm.installed AND gm.status='live' AND NOT gm.private
 AND g.visibility='market' AND NOT g.disabled AND g.connection_type<>'endpoint'
 AND EXISTS(SELECT 1 FROM public.curated_models c WHERE c.enabled AND (c.model_name=_model OR c.id=_model))
 AND d.day BETWEEN (now() AT TIME ZONE 'UTC')::date-6 AND (now() AT TIME ZONE 'UTC')::date GROUP BY g.name;
$function$
;

CREATE OR REPLACE FUNCTION public.garage_public_locations()
 RETURNS TABLE(garage_name text, country text, location_display text, location_source text, is_endpoint boolean, live_hours_per_week numeric, live_hours_total numeric, is_new boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH s AS (
    SELECT g.id,
      (SELECT ss.first_sampled_at FROM public.garage_status_summary ss WHERE ss.garage_id = g.id) AS first_at,
      (SELECT count(*) FILTER (WHERE x.online) FROM public.garage_status_samples x
        WHERE x.garage_id = g.id AND x.sampled_at >= now() - interval '28 days') AS online_n
    FROM public.garages g
  )
  SELECT g.name,
    CASE WHEN g.location_display = 'hidden' THEN NULL
         ELSE upper(COALESCE(g.country_override, CASE WHEN g.connection_type = 'endpoint' THEN g.declared_country ELSE g.measured_country END)) END,
    g.location_display,
    CASE WHEN g.country_override IS NOT NULL THEN 'admin' WHEN g.connection_type = 'endpoint' THEN 'provider' ELSE 'measured' END,
    g.connection_type = 'endpoint',
    -- weeks observed: min 1 day (1/7 week), max 4 weeks
    CASE WHEN g.connection_type = 'endpoint' OR s.first_at IS NULL THEN NULL ELSE round(
      s.online_n * (5.0 / 60.0)
      / greatest(1.0 / 7.0, least(4.0, extract(epoch FROM now() - s.first_at) / 86400.0 / 7.0)), 1) END,
    CASE WHEN g.connection_type = 'endpoint' OR s.first_at IS NULL THEN NULL ELSE round(s.online_n * (5.0 / 60.0), 1) END,
    CASE WHEN g.connection_type = 'endpoint' OR s.first_at IS NULL THEN NULL ELSE now() - s.first_at < interval '24 hours' END
  FROM public.garages g JOIN s ON s.id = g.id
  WHERE NOT g.disabled AND g.visibility = 'market';
$function$
;

CREATE OR REPLACE FUNCTION public.garage_public_models()
 RETURNS TABLE(garage_name text, model text, private boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT g.name, gm.canonical_model, gm.private
  FROM public.garage_models gm JOIN public.garages g ON g.id = gm.garage_id
  WHERE gm.offered AND gm.installed AND NOT g.disabled AND g.visibility = 'market'
$function$
;

CREATE OR REPLACE FUNCTION public.garage_public_providers()
 RETURNS TABLE(garage_name text, display_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT name, coalesce(display_name, name) FROM public.garages WHERE visibility = 'market' AND connection_type = 'endpoint' $function$
;

CREATE OR REPLACE FUNCTION public.garage_public_stats()
 RETURNS TABLE(garage_name text, runtime text, online boolean, tokens_7d bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT g.name, g.runtime,
    g.paused_at IS NULL AND g.status = 'online' AND g.runtime_ok IS DISTINCT FROM false AND EXISTS (
      SELECT 1 FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed AND gm.paused_at IS NULL AND gm.status = 'live'
    ),
    coalesce((SELECT sum(h.completion_tokens) FROM public.customer_garage_request_stats_hourly h WHERE h.garage_id = g.id AND h.hour >= now() - interval '7 days'), 0)::bigint
  FROM public.garages g WHERE NOT g.disabled AND g.visibility = 'market' AND (
    EXISTS (SELECT 1 FROM public.garage_status_summary ss WHERE ss.garage_id = g.id AND ss.first_online_at IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.garage_models gm WHERE gm.garage_id = g.id AND gm.offered AND gm.installed)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.garage_public_supply()
 RETURNS TABLE(garage_name text, is_endpoint boolean, terms_accepted boolean, forwards_to text, tokens_1d bigint, tokens_30d bigint, provider_region text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT g.name, g.connection_type = 'endpoint', g.terms_accepted_at IS NOT NULL,
    CASE WHEN g.connection_type = 'endpoint' AND g.endpoint_url ILIKE '%openrouter.ai%' THEN 'OpenRouter' END,
    coalesce((SELECT sum(h.prompt_tokens + h.completion_tokens) FROM public.customer_garage_request_stats_hourly h WHERE h.garage_id = g.id AND h.hour >= now() - interval '1 day'), 0)::bigint,
    coalesce((SELECT sum(h.prompt_tokens + h.completion_tokens) FROM public.customer_garage_request_stats_hourly h WHERE h.garage_id = g.id AND h.hour >= now() - interval '30 days'), 0)::bigint,
    CASE WHEN g.connection_type = 'endpoint' THEN g.provider_region END
  FROM public.garages g WHERE NOT g.disabled AND g.visibility = 'market'
$function$
;

CREATE OR REPLACE FUNCTION public.garage_reliability(_names text[] DEFAULT NULL::text[])
 RETURNS TABLE(garage_name text, period text, availability numeric, success_rate numeric, requests bigint, ttft_ms_p50 numeric, tokens_per_second numeric, score numeric, grade text, sample_days numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH g AS (
    SELECT id, name FROM public.garages WHERE visibility = 'market' AND (_names IS NULL OR name = ANY(_names))
  ),
  w AS (
    SELECT * FROM (VALUES ('24h', interval '24 hours'), ('7d', interval '7 days'), ('30d', interval '30 days')) v(period, span)
  ),
  first_s AS (
    SELECT ss.garage_id, ss.first_sampled_at AS first_at FROM public.garage_status_summary ss JOIN g ON g.id = ss.garage_id
  ),
  avail AS (
    SELECT g.id, w.period, avg(CASE WHEN s.online THEN 1.0 ELSE 0.0 END) AS a
    FROM g CROSS JOIN w
    LEFT JOIN public.garage_status_samples s ON s.garage_id = g.id AND s.sampled_at >= now() - w.span
    GROUP BY g.id, w.period
  ),
  req AS (
    SELECT g.id, w.period, sum(h.requests)::bigint AS reqs, sum(h.failures)::bigint AS fails,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY h.ttft_ms_p50) AS ttft
    FROM g CROSS JOIN w
    LEFT JOIN public.customer_garage_request_stats_hourly h ON h.garage_id = g.id AND h.hour >= now() - w.span
    GROUP BY g.id, w.period
  ),
  probe_ttft AS (
    SELECT g.id, w.period, percentile_cont(0.5) WITHIN GROUP (ORDER BY t.ttft_ms) AS ttft
    FROM g CROSS JOIN w
    LEFT JOIN public.garage_model_tests t ON t.garage_id = g.id AND t.passed AND t.tested_at >= now() - w.span
    GROUP BY g.id, w.period
  ),
  speed AS (
    SELECT g.id, percentile_cont(0.5) WITHIN GROUP (ORDER BY x.v) AS tps
    FROM g LEFT JOIN (
      SELECT garage_id, tokens_per_second_p50 AS v FROM public.customer_garage_request_stats_hourly
        WHERE hour >= now() - interval '7 days' AND tokens_per_second_p50 > 0
      UNION ALL
      SELECT garage_id, tokens_per_second FROM public.garage_model_tests
        WHERE tested_at >= now() - interval '7 days' AND passed AND tokens_per_second > 0
    ) x ON x.garage_id = g.id
    GROUP BY g.id
  ),
  calc AS (
    SELECT g.name, w.period, a.a AS availability,
      CASE WHEN coalesce(r.reqs, 0) > 0 THEN 1 - r.fails::numeric / r.reqs END AS success_rate,
      coalesce(r.reqs, 0) AS requests,
      coalesce(r.ttft, p.ttft)::numeric AS ttft,
      sp.tps::numeric AS tps,
      CASE WHEN f.first_at IS NULL THEN 0 ELSE extract(epoch FROM now() - f.first_at) / 86400 END AS sample_days
    FROM g CROSS JOIN w
    JOIN avail a ON a.id = g.id AND a.period = w.period
    JOIN req r ON r.id = g.id AND r.period = w.period
    JOIN probe_ttft p ON p.id = g.id AND p.period = w.period
    JOIN speed sp ON sp.id = g.id
    LEFT JOIN first_s f ON f.garage_id = g.id
  )
  SELECT name, period, round(availability, 4), round(success_rate, 4), requests,
    round(ttft), round(tps, 1),
    CASE WHEN availability IS NULL THEN NULL ELSE round(
      50 * availability + 30 * coalesce(success_rate, availability) + 20 * least(1, coalesce(tps, 0) / 30), 1) END AS score,
    CASE
      WHEN sample_days < 7 OR availability IS NULL THEN 'Nytt'
      WHEN 50 * availability + 30 * coalesce(success_rate, availability) + 20 * least(1, coalesce(tps, 0) / 30) >= 95 THEN 'A'
      WHEN 50 * availability + 30 * coalesce(success_rate, availability) + 20 * least(1, coalesce(tps, 0) / 30) >= 85 THEN 'B'
      WHEN 50 * availability + 30 * coalesce(success_rate, availability) + 20 * least(1, coalesce(tps, 0) / 30) >= 70 THEN 'C'
      ELSE 'D' END AS grade,
    round(sample_days::numeric, 1)
  FROM calc
$function$
;

CREATE OR REPLACE FUNCTION public.garage_revenue(_from timestamp with time zone, _to timestamp with time zone)
 RETURNS TABLE(garage_name text, display_name text, connection_type text, model text, runtime_models text[], requests bigint, failures bigint, prompt_tokens bigint, completion_tokens bigint, spend_usd numeric, cached_prompt_tokens bigint, input_spend_usd numeric, cached_spend_usd numeric, output_spend_usd numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(g.name, s.garage_name, s.garage_id::text), coalesce(g.display_name, s.garage_name || ' (deleted)'), coalesce(g.connection_type, 'deleted'),
    coalesce(gm.canonical_model, s.model),
    array_agg(DISTINCT s.model ORDER BY s.model),
    sum(s.requests)::bigint, sum(s.failures)::bigint, sum(s.prompt_tokens)::bigint, sum(s.completion_tokens)::bigint, coalesce(sum(s.spend_usd), 0),
    coalesce(sum(s.cached_prompt_tokens), 0)::bigint, coalesce(sum(s.input_spend_usd), 0), coalesce(sum(s.cached_spend_usd), 0), coalesce(sum(s.output_spend_usd), 0)
  FROM public.garage_model_stats_hourly s
  LEFT JOIN public.garages g ON g.id = s.garage_id
  LEFT JOIN public.garage_models gm ON gm.garage_id = s.garage_id AND gm.model = s.model
  WHERE public.has_role(auth.uid(), 'admin') AND s.hour >= _from AND s.hour < _to
  GROUP BY 1, 2, 3, 4
$function$
;

CREATE OR REPLACE FUNCTION public.garage_tool_support()
 RETURNS TABLE(garage_name text, model text, supports_tools boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM (
    SELECT DISTINCT ON (x.name, x.cm) x.name, x.cm, x.supports_tools FROM (
      SELECT g.name, coalesce(gm.canonical_model, t.model) AS cm, t.supports_tools, t.tested_at
      FROM public.garage_model_tests t JOIN public.garages g ON g.id = t.garage_id
      LEFT JOIN public.garage_models gm ON gm.garage_id = t.garage_id AND gm.model = t.model
      WHERE t.supports_tools IS NOT NULL AND (g.visibility = 'market' OR g.operator_id = auth.uid())
    ) x ORDER BY x.name, x.cm, x.tested_at DESC
  ) a
  UNION ALL
  SELECT 'auto'::text, coalesce(c.model_name, c.id), c.supports_tools
  FROM public.curated_models c WHERE c.garage_tier = 'auto' AND c.supports_tools IS NOT NULL
$function$
;

CREATE OR REPLACE FUNCTION public.garages_audit_smart()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN IF NEW.smart IS DISTINCT FROM OLD.smart THEN NEW.smart_changed_at:=now(); NEW.smart_changed_by:=auth.uid(); END IF; RETURN NEW; END $function$
;

CREATE OR REPLACE FUNCTION public.guard_account_terms()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
 IF (NEW.terms_version IS DISTINCT FROM OLD.terms_version OR NEW.terms_accepted_at IS DISTINCT FROM OLD.terms_accepted_at) AND current_user NOT IN ('postgres', 'supabase_admin') THEN
 RAISE EXCEPTION 'Use accept_account_terms to record acceptance' USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.guard_api_key_internal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN
IF TG_OP='INSERT' AND NEW.internal AND NEW.name !~* '^(test|probe|ops)' AND auth.role() IS DISTINCT FROM 'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins may classify internal keys'; END IF;
IF TG_OP='UPDATE' AND NEW.internal IS DISTINCT FROM OLD.internal AND auth.role() IS DISTINCT FROM 'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins may change internal traffic classification'; END IF;
IF NEW.name ~* '^(test|probe|ops)' THEN NEW.internal:=true; END IF; RETURN NEW; END $function$
;

CREATE OR REPLACE FUNCTION public.guard_garage_canary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.canary IS DISTINCT FROM OLD.canary AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'only admins can change the canary flag' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.guard_mail_test()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN IF NEW.mail_test IS DISTINCT FROM OLD.mail_test AND auth.role() IS DISTINCT FROM 'service_role' AND NOT public.has_role(auth.uid(),'admin') AND session_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'Only admins may mark mail test accounts' USING ERRCODE='42501'; END IF; RETURN NEW; END $function$
;

CREATE OR REPLACE FUNCTION public.guard_support_off()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN
 IF public.support_availability()->>'mode'='off' THEN
  IF TG_TABLE_NAME='support_threads' THEN RAISE EXCEPTION 'Support chat is currently off. You can still read existing replies from Account.';
  ELSIF NEW.sender='user' THEN RAISE EXCEPTION 'Support chat is currently off. You can still read existing replies from Account.';
  END IF;
 END IF; RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.guard_transport_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.transport NOT IN ('tunnel','endpoint') THEN RAISE EXCEPTION 'transport must be tunnel or endpoint'; END IF;
  ELSIF NEW.transport IS DISTINCT FROM OLD.transport AND NEW.transport NOT IN ('tunnel','endpoint') THEN
    RAISE EXCEPTION 'transport must be tunnel or endpoint';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE user_count int; requested_intent text; starting numeric; accepted boolean;
BEGIN
 accepted := NEW.raw_user_meta_data->>'account_terms_accepted' = 'true' AND NEW.raw_user_meta_data->>'account_terms_version' = public.account_terms_version();
 IF coalesce(NEW.raw_app_meta_data->>'provider', 'email') = 'email' AND accepted IS NOT TRUE THEN RAISE EXCEPTION 'Please accept the Terms and Privacy policy'; END IF;
 requested_intent := NEW.raw_user_meta_data->>'signup_intent';
 IF requested_intent NOT IN ('buyer', 'operator') THEN requested_intent := NULL; END IF;
 SELECT greatest(coalesce((SELECT nullif(value #>> '{}', '')::numeric FROM public.admin_settings WHERE key = 'default_user_budget_usd'), 0), 0) INTO starting;
 INSERT INTO public.profiles (id, email, full_name, signup_intent, starting_credit_usd, terms_version, terms_accepted_at)
 VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), requested_intent, starting, CASE WHEN accepted THEN public.account_terms_version() END, CASE WHEN accepted THEN now() END);
 SELECT COUNT(*) INTO user_count FROM auth.users;
 IF user_count = 1 THEN INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT (user_id, role) DO NOTHING; END IF;
 RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$
;

CREATE OR REPLACE FUNCTION public.management_key_auth(_hash text, _limit integer DEFAULT 60)
 RETURNS TABLE(id uuid, user_id uuid, allowed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.management_keys m SET
    last_used_at = now(),
    window_start = CASE WHEN m.window_start <= now() - interval '1 minute' THEN now() ELSE m.window_start END,
    window_count = CASE WHEN m.window_start <= now() - interval '1 minute' THEN 1 ELSE m.window_count + 1 END
  WHERE m.key_hash = _hash AND m.revoked_at IS NULL AND (m.expires_at IS NULL OR m.expires_at > now())
  RETURNING m.id, m.user_id, (m.window_count <= _limit);
END $function$
;

CREATE OR REPLACE FUNCTION public.mark_connect_page_seen()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.profiles SET connect_page_seen_at = now() WHERE id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.mark_offer_page_seen(_garage_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE garages SET offer_page_seen_at = now() WHERE id = _garage_id AND operator_id = auth.uid() AND offer_page_seen_at IS NULL;
$function$
;

CREATE OR REPLACE FUNCTION public.market_garage_visible(_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT EXISTS(SELECT 1 FROM public.garages WHERE name=_name AND visibility='market') $function$
;

CREATE OR REPLACE FUNCTION public.model_demand()
 RETURNS TABLE(model text, requests_7d bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT coalesce(gm.canonical_model,public.normalise_model_id(s.model)),sum(s.requests)::bigint FROM public.customer_garage_model_stats_hourly s LEFT JOIN public.garage_models gm ON gm.garage_id=s.garage_id AND regexp_replace(gm.model,'[^A-Za-z0-9._-]','-','g')=s.model WHERE s.hour>now()-interval '7 days' GROUP BY 1 $function$
;

CREATE OR REPLACE FUNCTION public.model_public_daily()
 RETURNS TABLE(model text, day date, requests bigint, prompt_tokens bigint, completion_tokens bigint, input_spend_usd numeric, output_spend_usd numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(gm.canonical_model, public.normalise_model_id(s.model)), s.hour::date,
    sum(s.requests)::bigint, sum(s.prompt_tokens)::bigint, sum(s.completion_tokens)::bigint,
    sum(s.input_spend_usd + s.cached_spend_usd), sum(s.output_spend_usd)
  FROM public.customer_garage_model_stats_hourly s
  JOIN public.garages g ON g.id = s.garage_id AND g.visibility = 'market' AND NOT g.disabled
  LEFT JOIN public.garage_models gm ON gm.garage_id = s.garage_id AND regexp_replace(gm.model,'[^A-Za-z0-9._-]','-','g') = s.model
  WHERE s.hour >= now() - interval '30 days' AND coalesce(gm.private, false) = false
  GROUP BY 1, 2
$function$
;

CREATE OR REPLACE FUNCTION public.model_quantization(_id text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT upper(substring(regexp_replace(trim(_id), '\.gguf$', '', 'i') from '(?i)[-_.:]((?:(?:ud|mix|i?q[0-9]+(?:_[a-z0-9]+)*|bf16|f16|f32)[-_.])*(?:i?q[0-9]+(?:_[a-z0-9]+)*|bf16|f16|f32)(?:[-_.]mix)?)$'))
$function$
;

CREATE OR REPLACE FUNCTION public.normalise_model_id(_id text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
END $function$
;

CREATE OR REPLACE FUNCTION public.operator_garage_activity()
 RETURNS TABLE(garage_id uuid, period text, requests bigint, prompt_tokens bigint, completion_tokens bigint, recorded_spend numeric, estimated_earnings numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH r AS (
SELECT g.id gid,w.period,s.payable_requests preq,s.payable_spend_usd pay,
 CASE WHEN coalesce(s.spend_usd,0)>0 THEN s.payable_spend_usd/s.spend_usd ELSE 0 END share,
 s.prompt_tokens pt,s.completion_tokens ct,
 ((s.prompt_tokens-s.dedicated_prompt_tokens)*coalesce(m.pool_input_cost_per_million,g.pool_input_cost_per_million)+s.dedicated_prompt_tokens*coalesce(m.dedicated_input_cost_per_million,g.dedicated_input_cost_per_million)+(s.completion_tokens-s.dedicated_completion_tokens)*coalesce(m.pool_output_cost_per_million,g.pool_output_cost_per_million)+s.dedicated_completion_tokens*coalesce(m.dedicated_output_cost_per_million,g.dedicated_output_cost_per_million))/1000000 est
FROM garages g CROSS JOIN(VALUES('7d',interval '7 days'),('30d',interval '30 days')) w(period,span) LEFT JOIN garage_model_stats_hourly s ON s.garage_id=g.id AND s.hour>=now()-w.span LEFT JOIN garage_models m ON m.garage_id=s.garage_id AND regexp_replace(m.model,'[^A-Za-z0-9._-]','-','g')=s.model WHERE g.operator_id=auth.uid() OR public.has_role(auth.uid(),'admin'))
SELECT gid,period,coalesce(sum(preq),0)::bigint,coalesce(round(sum(pt*share)),0)::bigint,coalesce(round(sum(ct*share)),0)::bigint,coalesce(sum(pay),0),coalesce(sum(least(coalesce(est,0)*share,pay)),0)
FROM r GROUP BY gid,period $function$
;

CREATE OR REPLACE FUNCTION public.operator_garage_overview(_garage_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ WITH own AS(SELECT id FROM garages WHERE id=_garage_id AND operator_id=auth.uid()),ledger AS(SELECT h.* FROM public.garage_request_stats_hourly h JOIN own ON own.id=h.garage_id),s AS(SELECT h.* FROM customer_garage_request_stats_hourly h JOIN own ON own.id=h.garage_id),m AS(SELECT h.model,sum(h.requests) requests FROM customer_garage_model_stats_hourly h JOIN own ON own.id=h.garage_id WHERE h.hour>=date_trunc('week',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' GROUP BY h.model) SELECT CASE WHEN EXISTS(SELECT 1 FROM own) THEN jsonb_build_object('today',coalesce((SELECT sum(payable_spend_usd) FROM ledger WHERE hour>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0),'week',coalesce((SELECT sum(payable_spend_usd) FROM ledger WHERE hour>=date_trunc('week',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0),'total',coalesce((SELECT sum(payable_spend_usd) FROM ledger),0),'trial_requests',coalesce((SELECT sum(trial_requests) FROM ledger),0),'own_requests',coalesce((SELECT sum(own_requests) FROM ledger),0),'last_request_at',(SELECT max(last_request_at) FROM s WHERE requests>0),'last_request_hour',(SELECT max(hour) FROM s WHERE requests>0),'response_ms',(SELECT percentile_cont(0.5) WITHIN GROUP(ORDER BY ttft_ms_p50) FROM s WHERE hour>=now()-interval '7 days' AND ttft_ms_p50>0),'daily',(SELECT jsonb_agg(jsonb_build_object('day',d.day::date,'requests',coalesce((SELECT sum(requests) FROM s WHERE hour>=d.day AND hour<d.day+interval '1 day'),0),'earned',coalesce((SELECT sum(payable_spend_usd) FROM ledger WHERE hour>=d.day AND hour<d.day+interval '1 day'),0)) ORDER BY d.day) FROM generate_series(date_trunc('day',now() AT TIME ZONE 'UTC')-interval '13 days',date_trunc('day',now() AT TIME ZONE 'UTC'),interval '1 day') d(day)),'models',coalesce((SELECT jsonb_agg(jsonb_build_object('model',model,'requests',requests)) FROM m),'[]'::jsonb)) END $function$
;

CREATE OR REPLACE FUNCTION public.prune_closed_support()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE n bigint; BEGIN DELETE FROM public.support_threads WHERE status='closed' AND closed_at<now()-interval '12 months'; GET DIAGNOSTICS n=ROW_COUNT; DELETE FROM public.support_prompt_days WHERE day<(now() AT TIME ZONE 'UTC')::date-2; RETURN n; END $function$
;

CREATE OR REPLACE FUNCTION public.prune_garage_energy()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE removed bigint;
BEGIN
 DELETE FROM public.garage_energy_windows WHERE at<now()-interval '90 days'; GET DIAGNOSTICS removed=ROW_COUNT;
 DELETE FROM public.garage_energy_daily WHERE day<(now() AT TIME ZONE 'UTC')::date-90;
 RETURN removed;
END $function$
;

CREATE OR REPLACE FUNCTION public.prune_onboarding_events()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE removed bigint;
BEGIN
 DELETE FROM public.onboarding_events WHERE created_at < now() - interval '12 months';
 GET DIAGNOSTICS removed = ROW_COUNT;
 RETURN removed;
END $function$
;

CREATE OR REPLACE FUNCTION public.record_bridge_release(p_version text, p_tag text, p_checked_at timestamp with time zone)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 INSERT INTO public.admin_settings(key,value) VALUES ('bridge_latest',jsonb_build_object('version',p_version,'tag',p_tag,'checked_at',p_checked_at)) ON CONFLICT (key) DO UPDATE SET value=coalesce(admin_settings.value,'{}'::jsonb)||excluded.value,updated_at=now();
$function$
;

CREATE OR REPLACE FUNCTION public.record_bridge_release(p_version text, p_tag text, p_checked_at timestamp with time zone, p_published_at timestamp with time zone)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 INSERT INTO public.admin_settings(key,value) VALUES ('bridge_latest',jsonb_build_object('version',p_version,'tag',p_tag,'checked_at',p_checked_at,'published_at',p_published_at))
 ON CONFLICT (key) DO UPDATE SET value=coalesce(admin_settings.value,'{}'::jsonb)||excluded.value,updated_at=now();
$function$
;

CREATE OR REPLACE FUNCTION public.record_bridge_run(_garage_id uuid, _version text, _error text, _error_version text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE g record;
BEGIN
  SELECT id, name, operator_id, canary INTO g FROM garages WHERE id = _garage_id;
  IF g IS NULL OR NOT (g.canary OR (g.operator_id IS NOT NULL AND public.has_role(g.operator_id, 'admin'))) THEN RETURN; END IF;
  IF _version IS NOT NULL AND _version ~ '^v[0-9]+\.[0-9]+\.[0-9]+' THEN
    INSERT INTO bridge_release_runs(version, garages_seen) VALUES (_version, ARRAY[g.name])
    ON CONFLICT (version) DO UPDATE SET last_seen_at = now(), first_seen_at = LEAST(bridge_release_runs.first_seen_at, now()),
      garages_seen = CASE WHEN g.name = ANY(bridge_release_runs.garages_seen) THEN bridge_release_runs.garages_seen ELSE bridge_release_runs.garages_seen || g.name END,
      error_garages = array_remove(bridge_release_runs.error_garages, g.name),
      update_errors = cardinality(array_remove(bridge_release_runs.error_garages, g.name));
  END IF;
  IF _error IS NOT NULL AND _error_version IS NOT NULL AND _error_version ~ '^v[0-9]+\.[0-9]+\.[0-9]+' THEN
    INSERT INTO bridge_release_runs(version, first_seen_at, last_seen_at, garages_seen, error_garages, update_errors, last_error)
    VALUES (_error_version, 'infinity', '-infinity', '{}', ARRAY[g.name], 1, left(_error, 300))
    ON CONFLICT (version) DO UPDATE SET last_error = left(_error, 300),
      error_garages = CASE WHEN g.name = ANY(bridge_release_runs.error_garages) THEN bridge_release_runs.error_garages ELSE bridge_release_runs.error_garages || g.name END,
      update_errors = cardinality(CASE WHEN g.name = ANY(bridge_release_runs.error_garages) THEN bridge_release_runs.error_garages ELSE bridge_release_runs.error_garages || g.name END);
  END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.record_garage_country()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.measured_country IS NOT NULL AND NEW.measured_country IS DISTINCT FROM OLD.measured_country THEN
    INSERT INTO public.garage_country_history (garage_id, country) VALUES (NEW.id, NEW.measured_country);
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.record_garage_prices()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF TG_OP = 'INSERT' OR (NEW.pool_input_cost_per_million,NEW.pool_output_cost_per_million,NEW.dedicated_input_cost_per_million,NEW.dedicated_output_cost_per_million,NEW.pool_cache_read_cost_per_million,NEW.dedicated_cache_read_cost_per_million) IS DISTINCT FROM (OLD.pool_input_cost_per_million,OLD.pool_output_cost_per_million,OLD.dedicated_input_cost_per_million,OLD.dedicated_output_cost_per_million,OLD.pool_cache_read_cost_per_million,OLD.dedicated_cache_read_cost_per_million) THEN
 INSERT INTO public.garage_price_history(garage_id,prices,changed_by) VALUES(NEW.id,jsonb_build_object('pool_input_cost_per_million',NEW.pool_input_cost_per_million,'pool_output_cost_per_million',NEW.pool_output_cost_per_million,'dedicated_input_cost_per_million',NEW.dedicated_input_cost_per_million,'dedicated_output_cost_per_million',NEW.dedicated_output_cost_per_million,'pool_cache_read_cost_per_million',NEW.pool_cache_read_cost_per_million,'dedicated_cache_read_cost_per_million',NEW.dedicated_cache_read_cost_per_million),auth.uid());
 END IF; RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.rename_api_key(_id uuid, _name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n text := btrim(coalesce(_name, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF length(n) < 1 OR length(n) > 80 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  UPDATE public.api_keys SET name = n WHERE id = _id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.request_managed_model(_garage_id uuid, _model text, _action text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM garages WHERE id = _garage_id AND (operator_id = auth.uid() OR has_role(auth.uid(), 'admin'))) THEN RAISE EXCEPTION 'not your garage'; END IF;
  PERFORM apply_managed_model_request(_garage_id, _model, _action, 'operator');
END $function$
;

CREATE OR REPLACE FUNCTION public.require_account_terms_for_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND public.account_terms_valid(terms_version)) THEN RAISE EXCEPTION 'Please accept the Terms and Privacy policy in the banner above before continuing.' USING ERRCODE = '42501'; END IF;
 RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.roll_garage_status_summary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.garage_status_summary AS s (garage_id, first_sampled_at, first_online_at, last_online_at)
  VALUES (NEW.garage_id, NEW.sampled_at, CASE WHEN NEW.online THEN NEW.sampled_at END, CASE WHEN NEW.online THEN NEW.sampled_at END)
  ON CONFLICT (garage_id) DO UPDATE SET
    first_sampled_at = least(s.first_sampled_at, EXCLUDED.first_sampled_at),
    first_online_at = CASE WHEN EXCLUDED.first_online_at IS NULL THEN s.first_online_at ELSE least(coalesce(s.first_online_at, EXCLUDED.first_online_at), EXCLUDED.first_online_at) END,
    last_online_at = greatest(s.last_online_at, EXCLUDED.last_online_at),
    updated_at = now();
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.set_bridge_pin(p_pinned text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF p_pinned IS NOT NULL AND p_pinned !~ '^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$' THEN RAISE EXCEPTION 'Invalid version'; END IF;
 INSERT INTO public.admin_settings(key,value) VALUES ('bridge_latest', jsonb_build_object('pinned',p_pinned)) ON CONFLICT (key) DO UPDATE SET value=jsonb_set(coalesce(admin_settings.value,'{}'::jsonb),'{pinned}',to_jsonb(coalesce(p_pinned,''))), updated_at=now();
END $function$
;

CREATE OR REPLACE FUNCTION public.set_bridge_update(p_stable text DEFAULT NULL::text, p_mode text DEFAULT NULL::text, p_auto_after_hours integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE patch jsonb := '{}'::jsonb; result jsonb; who text;
BEGIN
 IF NOT (coalesce(auth.role(),'') = 'service_role' OR public.has_role(auth.uid(), 'admin')) THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF p_stable IS NOT NULL THEN
   IF p_stable !~ '^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$' THEN RAISE EXCEPTION 'Invalid version'; END IF;
   IF coalesce(auth.role(),'') = 'service_role' THEN who := 'auto-promotion';
   ELSE SELECT 'admin (' || coalesce(nullif(full_name,''), email) || ')' INTO who FROM public.profiles WHERE id = auth.uid(); END IF;
   patch := patch || jsonb_build_object('stable', p_stable, 'stable_set_at', now(), 'stable_set_by', coalesce(who, 'admin'));
 END IF;
 IF p_mode IS NOT NULL THEN
   IF p_mode NOT IN ('manual','auto') THEN RAISE EXCEPTION 'Invalid mode'; END IF;
   patch := patch || jsonb_build_object('mode', p_mode);
 END IF;
 IF p_auto_after_hours IS NOT NULL THEN
   IF p_auto_after_hours < 0 OR p_auto_after_hours > 720 THEN RAISE EXCEPTION 'Invalid hours'; END IF;
   patch := patch || jsonb_build_object('auto_after_hours', p_auto_after_hours);
 END IF;
 INSERT INTO public.admin_settings(key,value) VALUES ('bridge_update', '{"mode":"auto","auto_after_hours":24}'::jsonb || patch)
 ON CONFLICT (key) DO UPDATE SET value = coalesce(admin_settings.value,'{}'::jsonb) || patch, updated_at = now()
 RETURNING value INTO result;
 RETURN result;
END $function$
;

CREATE OR REPLACE FUNCTION public.set_chat_sync(_on boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  UPDATE public.profiles SET chat_sync = _on, chat_sync_answered_at = now() WHERE id = auth.uid() RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
  RETURN jsonb_build_object('chat_sync', r.chat_sync, 'chat_sync_answered_at', r.chat_sync_answered_at);
END $function$
;

CREATE OR REPLACE FUNCTION public.set_garage_canary(_garage_id uuid, _canary boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'only admins can change the canary flag' USING ERRCODE = '42501'; END IF;
  UPDATE public.garages SET canary = _canary WHERE id = _garage_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.set_garage_location_display(_garage_id uuid, _mode text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _mode NOT IN ('country','region','hidden') THEN RAISE EXCEPTION 'invalid location display'; END IF;
  UPDATE public.garages SET location_display = _mode
   WHERE id = _garage_id AND (operator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
  IF NOT FOUND THEN RAISE EXCEPTION 'garage not found'; END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.set_garage_smart(_garage_id uuid, _smart boolean, _disk_gb numeric DEFAULT 40)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN
IF NOT EXISTS(SELECT 1 FROM garages WHERE id=_garage_id AND operator_id=auth.uid()) THEN RAISE EXCEPTION 'Not your garage'; END IF;
IF _smart IS NULL OR _disk_gb IS NULL OR _disk_gb<=0 OR _disk_gb>100000 THEN RAISE EXCEPTION 'Invalid disk budget'; END IF;
UPDATE garages SET smart=_smart,smart_disk_gb=_disk_gb WHERE id=_garage_id; END $function$
;

CREATE OR REPLACE FUNCTION public.set_machine_visibility(_garage_id uuid, _visibility text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF _visibility IS NULL OR _visibility NOT IN ('market','private') THEN RAISE EXCEPTION 'Invalid visibility'; END IF;
  UPDATE public.garages SET visibility=_visibility WHERE id=_garage_id AND operator_id=auth.uid() AND connection_type<>'endpoint';
  IF NOT FOUND THEN RAISE EXCEPTION 'Machine not found'; END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.set_mail_test(_user_id uuid, _enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF; UPDATE public.profiles SET mail_test=_enabled WHERE id=_user_id; END $function$
;

CREATE OR REPLACE FUNCTION public.set_operator_model_prices(_garage_id uuid, _model text, _pool_input numeric, _pool_output numeric, _direct_input numeric, _direct_output numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN
IF NOT EXISTS(SELECT 1 FROM garages WHERE id=_garage_id AND operator_id=auth.uid() AND connection_type<>'endpoint') THEN RAISE EXCEPTION 'Not your garage'; END IF;
IF _pool_input IS NULL OR _pool_output IS NULL OR _direct_input IS NULL OR _direct_output IS NULL OR least(_pool_input,_pool_output,_direct_input,_direct_output)<0 OR greatest(_pool_input,_pool_output,_direct_input,_direct_output)>10000 THEN RAISE EXCEPTION 'Invalid prices'; END IF;
UPDATE garage_models SET pool_input_cost_per_million=_pool_input,pool_output_cost_per_million=_pool_output,dedicated_input_cost_per_million=_direct_input,dedicated_output_cost_per_million=_direct_output WHERE garage_id=_garage_id AND model=_model;
IF NOT FOUND THEN RAISE EXCEPTION 'Model not found'; END IF;
INSERT INTO garage_price_history(garage_id,prices,changed_by) VALUES(_garage_id,jsonb_build_object('model',_model,'pool_input_cost_per_million',_pool_input,'pool_output_cost_per_million',_pool_output,'dedicated_input_cost_per_million',_direct_input,'dedicated_output_cost_per_million',_direct_output),auth.uid()); END $function$
;

CREATE OR REPLACE FUNCTION public.set_support_availability(_mode text, _away_until date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 IF _mode NOT IN ('on','away','off') THEN RAISE EXCEPTION 'Invalid support mode'; END IF;
 IF _mode='away' AND (_away_until IS NULL OR _away_until<(now() AT TIME ZONE 'UTC')::date) THEN RAISE EXCEPTION 'Choose today or a future date'; END IF;
 INSERT INTO public.admin_settings(key,value,updated_at) VALUES('support_chat',jsonb_build_object('mode',_mode,'away_until',CASE WHEN _mode='away' THEN _away_until ELSE NULL END),now()) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;
END $function$
;

CREATE OR REPLACE FUNCTION public.signup_welcome_eligible(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=_user_id AND p.created_at<=now()-interval '10 minutes' AND NOT EXISTS(SELECT 1 FROM public.api_keys k WHERE k.user_id=p.id) AND NOT EXISTS(SELECT 1 FROM public.garages g WHERE g.operator_id=p.id) AND NOT EXISTS(SELECT 1 FROM public.signup_welcome_notices n WHERE n.user_id=p.id AND n.sent_at IS NOT NULL)) $function$
;

CREATE OR REPLACE FUNCTION public.smart_model_demand()
 RETURNS TABLE(model text, requests_7d bigint, requests_14d bigint, healthy_garages bigint, distinct_keys_7d bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH rows AS(SELECT coalesce(gm.canonical_model,public.normalise_model_id(s.model)) model,s.hour,s.requests,s.api_keys FROM customer_garage_model_stats_hourly s LEFT JOIN garage_models gm ON gm.garage_id=s.garage_id AND s.model=regexp_replace(gm.model,'[^A-Za-z0-9._-]','-','g') WHERE s.hour>=now()-interval '14 days'),
demand AS(SELECT model,sum(requests) FILTER(WHERE hour>=now()-interval '7 days')::bigint r7,sum(requests)::bigint r14 FROM rows GROUP BY 1),
keys AS(SELECT model,count(DISTINCT k)::bigint n FROM rows,unnest(api_keys) k WHERE hour>=now()-interval '7 days' GROUP BY 1),
healthy AS(SELECT c.model_name model,count(DISTINCT c.garage)::bigint n FROM curated_models c JOIN garages g ON g.name=c.garage WHERE c.enabled AND c.status='healthy' AND c.garage_tier='pool' AND NOT g.disabled AND g.paused_at IS NULL AND g.runtime_ok=true AND g.mesh_connected IS DISTINCT FROM false AND g.last_gateway_check_at>=now()-interval '15 minutes' GROUP BY c.model_name)
SELECT d.model,coalesce(d.r7,0),coalesce(d.r14,0),coalesce(h.n,0),coalesce(k.n,0) FROM demand d LEFT JOIN healthy h ON h.model=d.model LEFT JOIN keys k ON k.model=d.model $function$
;

CREATE OR REPLACE FUNCTION public.stale_chat_keys(_days integer DEFAULT 30)
 RETURNS TABLE(id uuid, litellm_token text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT k.id, k.litellm_token FROM public.api_keys k
  WHERE k.kind = 'chat' AND k.is_active AND k.revoked_at IS NULL
    AND k.created_at < now() - make_interval(days => _days)
    AND NOT EXISTS (
      SELECT 1 FROM public.customer_garage_model_stats_hourly s
      WHERE s.hour >= now() - make_interval(days => _days)
        AND k.litellm_token IS NOT NULL
        AND encode(sha256(k.litellm_token::bytea), 'hex') = ANY(s.api_keys))
$function$
;

CREATE OR REPLACE FUNCTION public.support_availability()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT CASE WHEN s->>'mode'='off' THEN jsonb_build_object('mode','off','away_until',null) WHEN s->>'mode'='away' AND (s->>'away_until')::date >= (now() AT TIME ZONE 'UTC')::date THEN jsonb_build_object('mode','away','away_until',s->>'away_until') ELSE jsonb_build_object('mode','on','away_until',null) END FROM (SELECT coalesce((SELECT value FROM public.admin_settings WHERE key='support_chat'),'{"mode":"on","away_until":null}'::jsonb) s) q
$function$
;

CREATE OR REPLACE FUNCTION public.support_claim_prompt()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN
 IF auth.uid() IS NULL OR public.support_availability()->>'mode'<>'on' THEN RETURN false; END IF;
 INSERT INTO public.support_prompt_days(user_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING; RETURN FOUND;
END $function$
;

CREATE OR REPLACE FUNCTION public.support_diagnostics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid:=auth.uid(); key_at timestamptz; success boolean;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 SELECT min(created_at) INTO key_at FROM public.api_keys WHERE user_id=uid AND NOT internal;
 SELECT EXISTS(SELECT 1 FROM public.customer_garage_model_stats_hourly s JOIN public.api_keys k ON encode(sha256(convert_to(k.litellm_token,'UTF8')),'hex')=ANY(s.api_keys) WHERE k.user_id=uid AND NOT k.internal AND s.requests>s.failures) INTO success;
 RETURN jsonb_build_object('key_created_at',key_at,'has_successful_request',success,
 'events',coalesce((SELECT jsonb_agg(jsonb_build_object('garage_id',e.garage_id,'step',e.step,'status',e.status,'created_at',e.created_at)) FROM (SELECT e.* FROM public.onboarding_events e JOIN public.garages g ON g.id=e.garage_id WHERE g.operator_id=uid ORDER BY e.created_at DESC LIMIT 200) e),'[]'::jsonb),
 'failed_model',EXISTS(SELECT 1 FROM public.garage_models m JOIN public.garages g ON g.id=m.garage_id WHERE g.operator_id=uid AND m.status='failed' AND EXISTS(SELECT 1 FROM public.garage_model_tests t WHERE t.garage_id=g.id AND t.model=m.model AND NOT t.passed AND NOT t.inconclusive)));
END $function$
;

CREATE OR REPLACE FUNCTION public.support_founder_avatar()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT CASE WHEN auth.uid() IS NOT NULL THEN coalesce(u.raw_user_meta_data->>'avatar_url',u.raw_user_meta_data->>'picture') END FROM auth.users u WHERE u.id='9ca90269-8ab4-4a16-951f-555f32bf159c' AND public.has_role(u.id,'admin') $function$
;

CREATE OR REPLACE FUNCTION public.support_manage(_thread_id uuid, _status text DEFAULT NULL::text, _tag text DEFAULT NULL::text, _read boolean DEFAULT false, _admin boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$
;

CREATE OR REPLACE FUNCTION public.support_safe_text(_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ SELECT left(regexp_replace(regexp_replace(coalesce(_text,''),'(sk-[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]+)','[redacted]','g'),'(Bearer[[:space:]]+[^[:space:]]+|[A-Za-z_]*(key|token|secret|password)[[:space:]]*[:=][[:space:]]*[^[:space:],;]+)','[redacted]','gi'),500) $function$
;

CREATE OR REPLACE FUNCTION public.support_send(_body text, _thread_id uuid DEFAULT NULL::uuid, _context jsonb DEFAULT NULL::jsonb, _tag text DEFAULT 'other'::text, _admin boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$
;

CREATE OR REPLACE FUNCTION public.support_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT public.support_availability() || jsonb_build_object('open',(SELECT count(*) FROM public.support_threads WHERE status='open'),
 'waiting',coalesce((SELECT jsonb_agg(jsonb_build_object('thread_id',left(id::text,8),'waiting_minutes',greatest(0,floor(extract(epoch FROM(now()-last_user_message_at))/60)),'tag',tag) ORDER BY last_user_message_at) FROM public.support_threads WHERE status<>'closed' AND last_user_message_at IS NOT NULL AND (last_admin_message_at IS NULL OR last_user_message_at>last_admin_message_at)),'[]'::jsonb),
 'median_first_response_minutes_30d',(SELECT round(percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM(first_admin-first_user))/60)::numeric,1) FROM (SELECT t.id,min(m.created_at) FILTER(WHERE m.sender='user') first_user,min(m.created_at) FILTER(WHERE m.sender='admin') first_admin FROM public.support_threads t JOIN public.support_messages m ON m.thread_id=t.id WHERE t.created_at>=now()-interval '30 days' GROUP BY t.id) r WHERE first_admin>=first_user))
$function$
;

CREATE OR REPLACE FUNCTION public.validate_support_setting()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN
 IF NEW.key='support_chat' THEN
  IF jsonb_typeof(NEW.value)<>'object' OR coalesce(NEW.value->>'mode','') NOT IN ('on','away','off') THEN RAISE EXCEPTION 'Invalid support mode'; END IF;
  IF NEW.value->>'mode'='away' THEN
   IF coalesce(NEW.value->>'away_until','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Choose an away date'; END IF;
   PERFORM (NEW.value->>'away_until')::date;
  END IF;
 END IF; RETURN NEW; END $function$
;

CREATE OR REPLACE FUNCTION public.verify_cron_secret(secret text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_secrets
    WHERE name = 'sync_models_cron_secret' AND value = secret
  )
$function$
;


-- ======================================================================
-- Tables (51)
-- ======================================================================
CREATE TABLE public.admin_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.announcements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link_url text,
  link_text text,
  audience text DEFAULT 'all'::text NOT NULL,
  level text DEFAULT 'info'::text NOT NULL,
  starts_at timestamp with time zone DEFAULT now() NOT NULL,
  ends_at timestamp with time zone,
  created_by uuid DEFAULT auth.uid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.api_keys (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  key_value text NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone,
  trial_credits_usd numeric(10,2) DEFAULT 0,
  used_credits_usd numeric(10,2) DEFAULT 0,
  litellm_token text,
  revoked_at timestamp with time zone,
  internal boolean DEFAULT false NOT NULL,
  litellm_alias text,
  key_last4 text,
  kind text DEFAULT 'user'::text NOT NULL,
  device_label text,
  limit_usd numeric,
  limit_reset text,
  rpm integer,
  models text[],
  metadata jsonb,
  updated_at timestamp with time zone
);

CREATE TABLE public.auto_route (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  "position" integer NOT NULL,
  curated_model_id text,
  enabled boolean DEFAULT true NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  pool_model text
);

CREATE TABLE public.bridge_links (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  device_code_hash text NOT NULL,
  user_code text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  machine_id text,
  hostname text,
  os text,
  arch text,
  bridge_version text,
  gpu text,
  memory_gb integer,
  runtime text,
  models jsonb DEFAULT '[]'::jsonb NOT NULL,
  suggested_name text,
  requested_ip_country text,
  requested_ip_hash text,
  garage_id uuid,
  approved_by uuid,
  credentials jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + '00:10:00'::interval) NOT NULL,
  approved_at timestamp with time zone,
  last_poll_at timestamp with time zone,
  picked_up_at timestamp with time zone,
  entry text,
  transport text DEFAULT 'tunnel'::text NOT NULL
);

CREATE TABLE public.bridge_release_runs (
  version text NOT NULL,
  first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  garages_seen text[] DEFAULT '{}'::text[] NOT NULL,
  update_errors integer DEFAULT 0 NOT NULL,
  error_garages text[] DEFAULT '{}'::text[] NOT NULL,
  last_error text
);

CREATE TABLE public.buyer_first_requests (
  user_id uuid NOT NULL,
  first_request_at timestamp with time zone NOT NULL
);

CREATE TABLE public.chat_conversations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title text DEFAULT 'Ny chatt'::text NOT NULL,
  model text,
  messages jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.credit_payment_reversals (
  session_id text NOT NULL,
  charge_id text NOT NULL,
  charged_minor bigint NOT NULL,
  refunded_minor bigint DEFAULT 0 NOT NULL,
  disputed_minor bigint DEFAULT 0 NOT NULL,
  reversed_credits numeric DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.credit_transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  amount_usd numeric NOT NULL,
  credits_added numeric NOT NULL,
  stripe_session_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  stripe_event_id text,
  reason text,
  original_session_id text,
  stripe_charge_id text
);

CREATE TABLE public.curated_models (
  id text NOT NULL,
  provider text DEFAULT ''::text NOT NULL,
  max_input_tokens bigint,
  max_output_tokens bigint,
  input_cost_per_million numeric,
  output_cost_per_million numeric,
  mode text,
  status text DEFAULT 'unknown'::text NOT NULL,
  enabled boolean DEFAULT false NOT NULL,
  huggingface_url text,
  last_synced_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  model_name text,
  garage text,
  garage_tier text,
  disabled_reason text,
  cache_read_cost_per_million numeric,
  supports_tools boolean,
  ollama_tag text,
  download_bytes bigint,
  size_checked_at timestamp with time zone
);

CREATE TABLE public.customer_garage_model_stats_hourly (
  garage_id uuid NOT NULL,
  model text NOT NULL,
  hour timestamp with time zone NOT NULL,
  requests integer DEFAULT 0 NOT NULL,
  failures integer DEFAULT 0 NOT NULL,
  prompt_tokens bigint DEFAULT 0 NOT NULL,
  completion_tokens bigint DEFAULT 0 NOT NULL,
  spend_usd numeric DEFAULT 0 NOT NULL,
  dedicated_prompt_tokens bigint DEFAULT 0 NOT NULL,
  dedicated_completion_tokens bigint DEFAULT 0 NOT NULL,
  garage_name text,
  cached_prompt_tokens bigint DEFAULT 0 NOT NULL,
  input_spend_usd numeric DEFAULT 0 NOT NULL,
  cached_spend_usd numeric DEFAULT 0 NOT NULL,
  output_spend_usd numeric DEFAULT 0 NOT NULL,
  api_keys text[] DEFAULT '{}'::text[] NOT NULL,
  payable_spend_usd numeric DEFAULT 0 NOT NULL,
  trial_spend_usd numeric DEFAULT 0 NOT NULL,
  own_spend_usd numeric DEFAULT 0 NOT NULL,
  payable_requests integer DEFAULT 0 NOT NULL,
  trial_requests integer DEFAULT 0 NOT NULL,
  own_requests integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.customer_garage_request_stats_hourly (
  garage_id uuid NOT NULL,
  hour timestamp with time zone NOT NULL,
  requests integer DEFAULT 0 NOT NULL,
  failures integer DEFAULT 0 NOT NULL,
  ttft_ms_p50 integer,
  tokens_per_second_p50 numeric,
  completion_tokens bigint DEFAULT 0 NOT NULL,
  prompt_tokens bigint DEFAULT 0 NOT NULL,
  spend_usd numeric DEFAULT 0 NOT NULL,
  garage_name text,
  last_request_at timestamp with time zone,
  payable_spend_usd numeric DEFAULT 0 NOT NULL,
  trial_spend_usd numeric DEFAULT 0 NOT NULL,
  own_spend_usd numeric DEFAULT 0 NOT NULL,
  payable_requests integer DEFAULT 0 NOT NULL,
  trial_requests integer DEFAULT 0 NOT NULL,
  own_requests integer DEFAULT 0 NOT NULL,
  buyer_users uuid[] DEFAULT '{}'::uuid[] NOT NULL
);

CREATE TABLE public.customer_key_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  management_key_id uuid,
  action text NOT NULL,
  key_hash text,
  changed_fields text[] DEFAULT '{}'::text[] NOT NULL,
  at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.garage_country_history (
  id bigint DEFAULT nextval('garage_country_history_id_seq'::regclass) NOT NULL,
  garage_id uuid NOT NULL,
  country character(2) NOT NULL,
  seen_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.garage_energy_daily (
  garage_id uuid NOT NULL,
  model text DEFAULT ''::text NOT NULL,
  day date NOT NULL,
  source text DEFAULT ''::text NOT NULL,
  busy_wh numeric,
  wh numeric,
  out_tokens bigint,
  in_tokens bigint,
  efficiency_wh numeric DEFAULT 0 NOT NULL,
  efficiency_tokens bigint DEFAULT 0 NOT NULL,
  tokens_per_kwh numeric GENERATED ALWAYS AS (((efficiency_tokens)::numeric / NULLIF((efficiency_wh / (1000)::numeric), (0)::numeric))) STORED
);

CREATE TABLE public.garage_energy_windows (
  garage_id uuid NOT NULL,
  at timestamp with time zone DEFAULT now() NOT NULL,
  window_min integer,
  source text,
  wh numeric,
  busy_wh numeric,
  out_tokens bigint,
  in_tokens bigint,
  models jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE public.garage_managed_models (
  garage_id uuid NOT NULL,
  model text NOT NULL,
  action text NOT NULL,
  by text NOT NULL,
  status text DEFAULT 'wanted'::text NOT NULL,
  completed_mb numeric,
  total_mb numeric,
  error text,
  requested_at timestamp with time zone DEFAULT now() NOT NULL,
  reported_at timestamp with time zone
);

CREATE TABLE public.garage_model_failures (
  garage_id uuid NOT NULL,
  model text NOT NULL,
  consecutive_failures integer DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.garage_model_memory (
  garage_id uuid NOT NULL,
  model text NOT NULL,
  offered boolean NOT NULL,
  pool_input_cost_per_million numeric,
  pool_output_cost_per_million numeric,
  dedicated_input_cost_per_million numeric,
  dedicated_output_cost_per_million numeric,
  pool_cache_read_cost_per_million numeric,
  dedicated_cache_read_cost_per_million numeric,
  removed_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.garage_model_stats_hourly (
  garage_id uuid NOT NULL,
  model text NOT NULL,
  hour timestamp with time zone NOT NULL,
  requests integer DEFAULT 0 NOT NULL,
  failures integer DEFAULT 0 NOT NULL,
  prompt_tokens bigint DEFAULT 0 NOT NULL,
  completion_tokens bigint DEFAULT 0 NOT NULL,
  spend_usd numeric DEFAULT 0 NOT NULL,
  dedicated_prompt_tokens bigint DEFAULT 0 NOT NULL,
  dedicated_completion_tokens bigint DEFAULT 0 NOT NULL,
  garage_name text,
  cached_prompt_tokens bigint DEFAULT 0 NOT NULL,
  input_spend_usd numeric DEFAULT 0 NOT NULL,
  cached_spend_usd numeric DEFAULT 0 NOT NULL,
  output_spend_usd numeric DEFAULT 0 NOT NULL,
  api_keys text[] DEFAULT '{}'::text[] NOT NULL,
  payable_spend_usd numeric DEFAULT 0 NOT NULL,
  trial_spend_usd numeric DEFAULT 0 NOT NULL,
  own_spend_usd numeric DEFAULT 0 NOT NULL,
  payable_requests integer DEFAULT 0 NOT NULL,
  trial_requests integer DEFAULT 0 NOT NULL,
  own_requests integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.garage_model_tests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  garage_id uuid NOT NULL,
  model text NOT NULL,
  passed boolean NOT NULL,
  http_status integer,
  error text,
  ttft_ms integer,
  duration_ms integer,
  output_tokens integer,
  tokens_per_second numeric,
  instruction_followed boolean,
  tested_at timestamp with time zone DEFAULT now() NOT NULL,
  supports_tools boolean,
  tools_error text,
  inconclusive boolean DEFAULT false NOT NULL
);

CREATE TABLE public.garage_models (
  garage_id uuid NOT NULL,
  model text NOT NULL,
  installed boolean DEFAULT true NOT NULL,
  offered boolean DEFAULT false NOT NULL,
  status text DEFAULT 'untested'::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  paused_at timestamp with time zone,
  canonical_model text DEFAULT ''::text NOT NULL,
  canonical_source text DEFAULT 'auto'::text NOT NULL,
  private boolean DEFAULT false NOT NULL,
  context_length integer,
  pool_cache_read_cost_per_million numeric,
  dedicated_cache_read_cost_per_million numeric,
  missing_heartbeats integer DEFAULT 0 NOT NULL,
  pool_input_cost_per_million numeric,
  pool_output_cost_per_million numeric,
  dedicated_input_cost_per_million numeric,
  dedicated_output_cost_per_million numeric,
  quantization text
);

CREATE TABLE public.garage_price_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  garage_id uuid NOT NULL,
  prices jsonb NOT NULL,
  effective_from timestamp with time zone DEFAULT now() NOT NULL,
  changed_by uuid,
  garage_name text
);

CREATE TABLE public.garage_region_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  garage_id uuid NOT NULL,
  region text,
  previous_region text,
  actor_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.garage_request_stats_hourly (
  garage_id uuid NOT NULL,
  hour timestamp with time zone NOT NULL,
  requests integer DEFAULT 0 NOT NULL,
  failures integer DEFAULT 0 NOT NULL,
  ttft_ms_p50 integer,
  tokens_per_second_p50 numeric,
  completion_tokens bigint DEFAULT 0 NOT NULL,
  prompt_tokens bigint DEFAULT 0 NOT NULL,
  spend_usd numeric DEFAULT 0 NOT NULL,
  garage_name text,
  last_request_at timestamp with time zone,
  payable_spend_usd numeric DEFAULT 0 NOT NULL,
  trial_spend_usd numeric DEFAULT 0 NOT NULL,
  own_spend_usd numeric DEFAULT 0 NOT NULL,
  payable_requests integer DEFAULT 0 NOT NULL,
  trial_requests integer DEFAULT 0 NOT NULL,
  own_requests integer DEFAULT 0 NOT NULL,
  buyer_users uuid[] DEFAULT '{}'::uuid[] NOT NULL
);

CREATE TABLE public.garage_runtime_secrets (
  garage_id uuid NOT NULL,
  runtime_api_key text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.garage_smart_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  garage_id uuid NOT NULL,
  operator_id uuid NOT NULL,
  day date DEFAULT ((now() AT TIME ZONE 'UTC'::text))::date NOT NULL,
  model text NOT NULL,
  action text NOT NULL,
  reason jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  email_sent_at timestamp with time zone
);

CREATE TABLE public.garage_status_samples (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  garage_id uuid NOT NULL,
  sampled_at timestamp with time zone DEFAULT now() NOT NULL,
  online boolean NOT NULL,
  reason text
);

CREATE TABLE public.garage_status_summary (
  garage_id uuid NOT NULL,
  first_sampled_at timestamp with time zone NOT NULL,
  first_online_at timestamp with time zone,
  last_online_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.garage_terms_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  garage_id uuid NOT NULL,
  action text NOT NULL,
  terms_version text,
  accepted_at timestamp with time zone,
  note text,
  actor_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.garage_tokens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  garage_id uuid NOT NULL,
  token_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  revoked_at timestamp with time zone,
  relink boolean DEFAULT false NOT NULL
);

CREATE TABLE public.garages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  operator_id uuid,
  api_host text,
  runtime text,
  port integer,
  models text[] DEFAULT '{}'::text[] NOT NULL,
  mesh_ip text,
  netbird_peer_id text,
  status text DEFAULT 'pending'::text NOT NULL,
  dedicated_input_cost_per_million numeric DEFAULT 0.30 NOT NULL,
  dedicated_output_cost_per_million numeric DEFAULT 1.20 NOT NULL,
  pool_input_cost_per_million numeric DEFAULT 0.15 NOT NULL,
  pool_output_cost_per_million numeric DEFAULT 0.60 NOT NULL,
  last_registered_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  disabled boolean DEFAULT false NOT NULL,
  last_heartbeat_at timestamp with time zone,
  connection_type text DEFAULT 'mesh'::text NOT NULL,
  endpoint_url text,
  display_name text,
  last_gateway_check_at timestamp with time zone,
  mesh_connected boolean,
  runtime_ok boolean,
  runtime_error text,
  runtime_models text[] DEFAULT '{}'::text[] NOT NULL,
  paused_at timestamp with time zone,
  paused_reason text,
  measured_country character(2),
  measured_country_at timestamp with time zone,
  location_display text DEFAULT 'country'::text NOT NULL,
  declared_country character(2),
  country_override character(2),
  terms_accepted_at timestamp with time zone,
  terms_version text,
  pool_cache_read_cost_per_million numeric,
  dedicated_cache_read_cost_per_million numeric,
  agent jsonb,
  agent_at timestamp with time zone,
  machine_id text,
  machine_hostname text,
  last_machine_id text,
  transport text DEFAULT 'tunnel'::text NOT NULL,
  tunnel_public_key text,
  tunnel_ip text,
  tunnel_assigned_at timestamp with time zone,
  paused_by_admin boolean DEFAULT false NOT NULL,
  first_models_at timestamp with time zone,
  offer_page_seen_at timestamp with time zone,
  canary boolean DEFAULT false NOT NULL,
  smart boolean DEFAULT true NOT NULL,
  smart_disk_gb numeric DEFAULT 40 NOT NULL,
  agent_state jsonb,
  agent_nodes jsonb,
  smart_changed_at timestamp with time zone,
  smart_changed_by uuid,
  visibility text DEFAULT 'market'::text NOT NULL,
  terms_accepted_by uuid,
  terms_accepted_via text,
  terms_note text,
  provider_region text,
  provider_region_by uuid,
  provider_region_at timestamp with time zone
);

CREATE TABLE public.gateway_key_records (
  fingerprint text NOT NULL,
  alias text,
  internal boolean DEFAULT false NOT NULL,
  checked_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ingest_cursors (
  name text NOT NULL,
  value timestamp with time zone NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  last_row_at timestamp with time zone,
  last_request_id text
);

CREATE TABLE public.internal_model_stats_hourly (
  garage_id uuid NOT NULL,
  model text NOT NULL,
  hour timestamp with time zone NOT NULL,
  requests bigint DEFAULT 0 NOT NULL,
  tokens bigint DEFAULT 0 NOT NULL,
  spend_usd numeric DEFAULT 0 NOT NULL
);

CREATE TABLE public.internal_secrets (
  name text NOT NULL,
  value text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.mail_delivery_state (
  user_id uuid NOT NULL,
  total_sent integer DEFAULT 0 NOT NULL,
  recent_sent timestamp with time zone[] DEFAULT '{}'::timestamp with time zone[] NOT NULL,
  sent_events jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.mail_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  template_key text NOT NULL,
  event_ref text DEFAULT ''::text NOT NULL,
  mode text NOT NULL,
  status text NOT NULL,
  provider_message_id text,
  error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  provider text
);

CREATE TABLE public.mail_templates (
  key text NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  subject_en text NOT NULL,
  body_en text NOT NULL,
  subject_sv text NOT NULL,
  body_sv text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  kind text DEFAULT 'service'::text NOT NULL
);

CREATE TABLE public.mail_worker_lock (
  singleton boolean DEFAULT true NOT NULL,
  owner uuid NOT NULL,
  until_at timestamp with time zone NOT NULL
);

CREATE TABLE public.management_keys (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_last4 text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  last_used_at timestamp with time zone,
  window_start timestamp with time zone DEFAULT now() NOT NULL,
  window_count integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.market_prices (
  model_id text NOT NULL,
  input_per_m numeric NOT NULL,
  output_per_m numeric NOT NULL,
  fetched_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.onboarding_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  garage_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  step text NOT NULL,
  status text NOT NULL,
  message text,
  script_version text,
  node_name text,
  runtime text,
  port text,
  os text,
  arch text,
  gpu text,
  memory_gb text,
  profile jsonb,
  machine_id text
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  company text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  purchased_credits_usd numeric DEFAULT 0 NOT NULL,
  litellm_user_id text,
  signup_intent text,
  onboarding_done boolean DEFAULT false NOT NULL,
  preferred_language text DEFAULT 'en'::text NOT NULL,
  starting_credit_usd numeric DEFAULT 0 NOT NULL,
  connect_page_seen_at timestamp with time zone,
  terms_version text,
  terms_accepted_at timestamp with time zone,
  chat_sync boolean DEFAULT false NOT NULL,
  default_key_at timestamp with time zone,
  chat_sync_answered_at timestamp with time zone,
  terms_notice_dismissed_version text,
  first_goal text,
  first_goal_at timestamp with time zone,
  first_goal_asked boolean DEFAULT false NOT NULL,
  mail_test boolean DEFAULT false NOT NULL,
  mail_opt_out_at timestamp with time zone,
  mail_language text DEFAULT 'en'::text NOT NULL
);

CREATE TABLE public.signup_welcome_notices (
  user_id uuid NOT NULL,
  event_id uuid DEFAULT gen_random_uuid() NOT NULL,
  sent_at timestamp with time zone
);

CREATE TABLE public.support_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  thread_id uuid NOT NULL,
  sender text NOT NULL,
  body text NOT NULL,
  context jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.support_prompt_days (
  user_id uuid NOT NULL,
  day date DEFAULT ((now() AT TIME ZONE 'UTC'::text))::date NOT NULL
);

CREATE TABLE public.support_threads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  status text DEFAULT 'open'::text NOT NULL,
  tag text DEFAULT 'other'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  last_user_message_at timestamp with time zone,
  last_admin_message_at timestamp with time zone,
  user_read_at timestamp with time zone,
  admin_read_at timestamp with time zone,
  closed_at timestamp with time zone
);

CREATE TABLE public.token_usage (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  api_key_id uuid NOT NULL,
  user_id uuid NOT NULL,
  tokens_used bigint NOT NULL,
  cost_usd numeric(10,4) NOT NULL,
  model text,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  role app_role NOT NULL
);


-- ======================================================================
-- Primary keys, unique and check constraints (140)
-- ======================================================================
ALTER TABLE ONLY public.admin_settings ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.announcements ADD CONSTRAINT announcement_link CHECK (((link_url IS NULL) OR (link_url ~ '^https?://'::text)));
ALTER TABLE ONLY public.announcements ADD CONSTRAINT announcement_window CHECK (((ends_at IS NULL) OR (ends_at >= starts_at)));
ALTER TABLE ONLY public.announcements ADD CONSTRAINT announcements_audience_check CHECK ((audience = ANY (ARRAY['all'::text, 'operators'::text, 'buyers'::text])));
ALTER TABLE ONLY public.announcements ADD CONSTRAINT announcements_body_check CHECK ((char_length(body) <= 300));
ALTER TABLE ONLY public.announcements ADD CONSTRAINT announcements_level_check CHECK ((level = ANY (ARRAY['info'::text, 'warning'::text])));
ALTER TABLE ONLY public.announcements ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.announcements ADD CONSTRAINT announcements_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0));
ALTER TABLE ONLY public.api_keys ADD CONSTRAINT api_keys_key_value_key UNIQUE (key_value);
ALTER TABLE ONLY public.api_keys ADD CONSTRAINT api_keys_kind_check CHECK ((kind = ANY (ARRAY['user'::text, 'default'::text, 'chat'::text, 'managed'::text])));
ALTER TABLE ONLY public.api_keys ADD CONSTRAINT api_keys_limit_reset_check CHECK (((limit_reset IS NULL) OR (limit_reset = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text]))));
ALTER TABLE ONLY public.api_keys ADD CONSTRAINT api_keys_limit_usd_check CHECK (((limit_usd IS NULL) OR (limit_usd >= (0)::numeric)));
ALTER TABLE ONLY public.api_keys ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.api_keys ADD CONSTRAINT api_keys_rpm_check CHECK (((rpm IS NULL) OR (rpm > 0)));
ALTER TABLE ONLY public.auto_route ADD CONSTRAINT auto_route_curated_model_id_key UNIQUE (curated_model_id);
ALTER TABLE ONLY public.auto_route ADD CONSTRAINT auto_route_exactly_one_target CHECK (((curated_model_id IS NOT NULL) <> (pool_model IS NOT NULL)));
ALTER TABLE ONLY public.auto_route ADD CONSTRAINT auto_route_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.auto_route ADD CONSTRAINT auto_route_position_check CHECK (("position" >= 1));
ALTER TABLE ONLY public.bridge_links ADD CONSTRAINT bridge_links_device_code_hash_key UNIQUE (device_code_hash);
ALTER TABLE ONLY public.bridge_links ADD CONSTRAINT bridge_links_entry_check CHECK ((entry = ANY (ARRAY['web'::text, 'terminal'::text])));
ALTER TABLE ONLY public.bridge_links ADD CONSTRAINT bridge_links_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bridge_links ADD CONSTRAINT bridge_links_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'picked_up'::text, 'expired'::text])));
ALTER TABLE ONLY public.bridge_links ADD CONSTRAINT bridge_links_transport_check CHECK ((transport = ANY (ARRAY['tunnel'::text, 'endpoint'::text, 'netbird'::text])));
ALTER TABLE ONLY public.bridge_links ADD CONSTRAINT bridge_links_user_code_key UNIQUE (user_code);
ALTER TABLE ONLY public.bridge_release_runs ADD CONSTRAINT bridge_release_runs_pkey PRIMARY KEY (version);
ALTER TABLE ONLY public.buyer_first_requests ADD CONSTRAINT buyer_first_requests_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.chat_conversations ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.credit_payment_reversals ADD CONSTRAINT credit_payment_reversals_charged_minor_check CHECK ((charged_minor > 0));
ALTER TABLE ONLY public.credit_payment_reversals ADD CONSTRAINT credit_payment_reversals_disputed_minor_check CHECK ((disputed_minor >= 0));
ALTER TABLE ONLY public.credit_payment_reversals ADD CONSTRAINT credit_payment_reversals_pkey PRIMARY KEY (session_id);
ALTER TABLE ONLY public.credit_payment_reversals ADD CONSTRAINT credit_payment_reversals_refunded_minor_check CHECK ((refunded_minor >= 0));
ALTER TABLE ONLY public.credit_transactions ADD CONSTRAINT credit_transactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.credit_transactions ADD CONSTRAINT credit_transactions_stripe_session_id_key UNIQUE (stripe_session_id);
ALTER TABLE ONLY public.curated_models ADD CONSTRAINT curated_models_disabled_reason_check CHECK (((disabled_reason IS NULL) OR (disabled_reason = ANY (ARRAY['admin'::text, 'failed_test'::text]))));
ALTER TABLE ONLY public.curated_models ADD CONSTRAINT curated_models_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.customer_garage_model_stats_hourly ADD CONSTRAINT customer_garage_model_stats_hourly_pkey PRIMARY KEY (garage_id, model, hour);
ALTER TABLE ONLY public.customer_garage_request_stats_hourly ADD CONSTRAINT customer_garage_request_stats_hourly_pkey PRIMARY KEY (garage_id, hour);
ALTER TABLE ONLY public.customer_key_events ADD CONSTRAINT customer_key_events_action_check CHECK ((action = ANY (ARRAY['create'::text, 'update'::text, 'disable'::text, 'enable'::text, 'delete'::text])));
ALTER TABLE ONLY public.customer_key_events ADD CONSTRAINT customer_key_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.garage_country_history ADD CONSTRAINT garage_country_history_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.garage_energy_daily ADD CONSTRAINT garage_energy_daily_pkey PRIMARY KEY (garage_id, model, day, source);
ALTER TABLE ONLY public.garage_energy_windows ADD CONSTRAINT garage_energy_windows_busy_wh_check CHECK (((busy_wh >= (0)::numeric) AND (busy_wh <= (5000)::numeric)));
ALTER TABLE ONLY public.garage_energy_windows ADD CONSTRAINT garage_energy_windows_in_tokens_check CHECK (((in_tokens >= 0) AND (in_tokens <= 1000000000)));
ALTER TABLE ONLY public.garage_energy_windows ADD CONSTRAINT garage_energy_windows_models_check CHECK (((jsonb_typeof(models) = 'array'::text) AND (jsonb_array_length(models) <= 50)));
ALTER TABLE ONLY public.garage_energy_windows ADD CONSTRAINT garage_energy_windows_out_tokens_check CHECK (((out_tokens >= 0) AND (out_tokens <= 1000000000)));
ALTER TABLE ONLY public.garage_energy_windows ADD CONSTRAINT garage_energy_windows_pkey PRIMARY KEY (garage_id, at);
ALTER TABLE ONLY public.garage_energy_windows ADD CONSTRAINT garage_energy_windows_source_check CHECK ((source = ANY (ARRAY['nvidia-smi'::text, 'powermetrics'::text])));
ALTER TABLE ONLY public.garage_energy_windows ADD CONSTRAINT garage_energy_windows_wh_check CHECK (((wh >= (0)::numeric) AND (wh <= (5000)::numeric)));
ALTER TABLE ONLY public.garage_energy_windows ADD CONSTRAINT garage_energy_windows_window_min_check CHECK (((window_min >= 1) AND (window_min <= 60)));
ALTER TABLE ONLY public.garage_managed_models ADD CONSTRAINT garage_managed_models_action_check CHECK ((action = ANY (ARRAY['pull'::text, 'remove'::text])));
ALTER TABLE ONLY public.garage_managed_models ADD CONSTRAINT garage_managed_models_by_check CHECK ((by = ANY (ARRAY['operator'::text, 'garageai'::text, 'ops-test'::text])));
ALTER TABLE ONLY public.garage_managed_models ADD CONSTRAINT garage_managed_models_pkey PRIMARY KEY (garage_id, model);
ALTER TABLE ONLY public.garage_managed_models ADD CONSTRAINT garage_managed_models_status_check CHECK ((status = ANY (ARRAY['wanted'::text, 'downloading'::text, 'ready'::text, 'failed'::text, 'removed'::text, 'refused'::text])));
ALTER TABLE ONLY public.garage_model_failures ADD CONSTRAINT garage_model_failures_pkey PRIMARY KEY (garage_id, model);
ALTER TABLE ONLY public.garage_model_memory ADD CONSTRAINT garage_model_memory_pkey PRIMARY KEY (garage_id, model);
ALTER TABLE ONLY public.garage_model_stats_hourly ADD CONSTRAINT garage_model_stats_hourly_pkey PRIMARY KEY (garage_id, model, hour);
ALTER TABLE ONLY public.garage_model_tests ADD CONSTRAINT garage_model_tests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.garage_models ADD CONSTRAINT garage_models_canonical_source_check CHECK ((canonical_source = ANY (ARRAY['auto'::text, 'admin'::text])));
ALTER TABLE ONLY public.garage_models ADD CONSTRAINT garage_models_dedicated_cache_read_cost_per_million_check CHECK ((dedicated_cache_read_cost_per_million >= (0)::numeric));
ALTER TABLE ONLY public.garage_models ADD CONSTRAINT garage_models_dedicated_input_cost_per_million_check CHECK ((dedicated_input_cost_per_million >= (0)::numeric));
ALTER TABLE ONLY public.garage_models ADD CONSTRAINT garage_models_dedicated_output_cost_per_million_check CHECK ((dedicated_output_cost_per_million >= (0)::numeric));
ALTER TABLE ONLY public.garage_models ADD CONSTRAINT garage_models_pkey PRIMARY KEY (garage_id, model);
ALTER TABLE ONLY public.garage_models ADD CONSTRAINT garage_models_pool_cache_read_cost_per_million_check CHECK ((pool_cache_read_cost_per_million >= (0)::numeric));
ALTER TABLE ONLY public.garage_models ADD CONSTRAINT garage_models_pool_input_cost_per_million_check CHECK ((pool_input_cost_per_million >= (0)::numeric));
ALTER TABLE ONLY public.garage_models ADD CONSTRAINT garage_models_pool_output_cost_per_million_check CHECK ((pool_output_cost_per_million >= (0)::numeric));
ALTER TABLE ONLY public.garage_models ADD CONSTRAINT garage_models_status_check CHECK ((status = ANY (ARRAY['untested'::text, 'testing'::text, 'live'::text, 'failed'::text, 'paused'::text])));
ALTER TABLE ONLY public.garage_price_history ADD CONSTRAINT garage_price_history_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.garage_region_events ADD CONSTRAINT garage_region_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.garage_region_events ADD CONSTRAINT garage_region_events_region_check CHECK ((region = ANY (ARRAY['se'::text, 'eu'::text, 'other'::text])));
ALTER TABLE ONLY public.garage_request_stats_hourly ADD CONSTRAINT garage_request_stats_hourly_pkey PRIMARY KEY (garage_id, hour);
ALTER TABLE ONLY public.garage_runtime_secrets ADD CONSTRAINT garage_runtime_secrets_pkey PRIMARY KEY (garage_id);
ALTER TABLE ONLY public.garage_smart_events ADD CONSTRAINT garage_smart_events_action_check CHECK ((action = ANY (ARRAY['pull'::text, 'remove'::text])));
ALTER TABLE ONLY public.garage_smart_events ADD CONSTRAINT garage_smart_events_garage_id_day_key UNIQUE (garage_id, day);
ALTER TABLE ONLY public.garage_smart_events ADD CONSTRAINT garage_smart_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.garage_status_samples ADD CONSTRAINT garage_status_samples_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.garage_status_samples ADD CONSTRAINT garage_status_samples_reason_check CHECK (((reason IS NULL) OR (reason = ANY (ARRAY['no_heartbeat'::text, 'mesh_disconnected'::text, 'no_models'::text]))));
ALTER TABLE ONLY public.garage_status_summary ADD CONSTRAINT garage_status_summary_pkey PRIMARY KEY (garage_id);
ALTER TABLE ONLY public.garage_terms_events ADD CONSTRAINT garage_terms_events_action_check CHECK ((action = ANY (ARRAY['record'::text, 'clear'::text])));
ALTER TABLE ONLY public.garage_terms_events ADD CONSTRAINT garage_terms_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.garage_tokens ADD CONSTRAINT garage_tokens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.garage_tokens ADD CONSTRAINT garage_tokens_token_hash_key UNIQUE (token_hash);
ALTER TABLE ONLY public.garages ADD CONSTRAINT garages_connection_type_check CHECK ((connection_type = ANY (ARRAY['mesh'::text, 'endpoint'::text])));
ALTER TABLE ONLY public.garages ADD CONSTRAINT garages_dedicated_cache_read_cost_per_million_check CHECK ((dedicated_cache_read_cost_per_million >= (0)::numeric));
ALTER TABLE ONLY public.garages ADD CONSTRAINT garages_location_display_check CHECK ((location_display = ANY (ARRAY['country'::text, 'region'::text, 'hidden'::text])));
ALTER TABLE ONLY public.garages ADD CONSTRAINT garages_name_check CHECK ((name ~ '^[a-z0-9][a-z0-9-]{1,40}$'::text));
ALTER TABLE ONLY public.garages ADD CONSTRAINT garages_name_key UNIQUE (name);
ALTER TABLE ONLY public.garages ADD CONSTRAINT garages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.garages ADD CONSTRAINT garages_pool_cache_read_cost_per_million_check CHECK ((pool_cache_read_cost_per_million >= (0)::numeric));
ALTER TABLE ONLY public.garages ADD CONSTRAINT garages_provider_region_check CHECK ((provider_region = ANY (ARRAY['se'::text, 'eu'::text, 'other'::text])));
ALTER TABLE ONLY public.garages ADD CONSTRAINT garages_smart_disk_gb_check CHECK (((smart_disk_gb > (0)::numeric) AND (smart_disk_gb <= (100000)::numeric)));
ALTER TABLE ONLY public.garages ADD CONSTRAINT garages_transport_check CHECK ((transport = ANY (ARRAY['tunnel'::text, 'endpoint'::text, 'netbird'::text])));
ALTER TABLE ONLY public.garages ADD CONSTRAINT garages_tunnel_ip_key UNIQUE (tunnel_ip);
ALTER TABLE ONLY public.garages ADD CONSTRAINT garages_tunnel_public_key_key UNIQUE (tunnel_public_key);
ALTER TABLE ONLY public.garages ADD CONSTRAINT garages_visibility_check CHECK ((visibility = ANY (ARRAY['market'::text, 'private'::text])));
ALTER TABLE ONLY public.gateway_key_records ADD CONSTRAINT gateway_key_records_pkey PRIMARY KEY (fingerprint);
ALTER TABLE ONLY public.ingest_cursors ADD CONSTRAINT ingest_cursors_pkey PRIMARY KEY (name);
ALTER TABLE ONLY public.internal_model_stats_hourly ADD CONSTRAINT internal_model_stats_hourly_pkey PRIMARY KEY (garage_id, model, hour);
ALTER TABLE ONLY public.internal_secrets ADD CONSTRAINT internal_secrets_pkey PRIMARY KEY (name);
ALTER TABLE ONLY public.mail_delivery_state ADD CONSTRAINT mail_delivery_state_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.mail_delivery_state ADD CONSTRAINT mail_delivery_state_total_sent_check CHECK ((total_sent >= 0));
ALTER TABLE ONLY public.mail_log ADD CONSTRAINT mail_log_mode_check CHECK ((mode = ANY (ARRAY['off'::text, 'test'::text, 'on'::text])));
ALTER TABLE ONLY public.mail_log ADD CONSTRAINT mail_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.mail_log ADD CONSTRAINT mail_log_provider_check CHECK (((provider IS NULL) OR (provider = ANY (ARRAY['cloudflare'::text, 'brevo'::text]))));
ALTER TABLE ONLY public.mail_log ADD CONSTRAINT mail_log_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped_cap'::text, 'skipped_opt_out'::text, 'skipped_provider'::text])));
ALTER TABLE ONLY public.mail_templates ADD CONSTRAINT mail_templates_key_check CHECK ((key = ANY (ARRAY['first_request_nudge'::text, 'connect_garage_nudge'::text, 'garage_offline'::text])));
ALTER TABLE ONLY public.mail_templates ADD CONSTRAINT mail_templates_kind_check CHECK ((kind = ANY (ARRAY['service'::text, 'marketing'::text])));
ALTER TABLE ONLY public.mail_templates ADD CONSTRAINT mail_templates_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.mail_worker_lock ADD CONSTRAINT mail_worker_lock_pkey PRIMARY KEY (singleton);
ALTER TABLE ONLY public.mail_worker_lock ADD CONSTRAINT mail_worker_lock_singleton_check CHECK (singleton);
ALTER TABLE ONLY public.management_keys ADD CONSTRAINT management_keys_key_hash_key UNIQUE (key_hash);
ALTER TABLE ONLY public.management_keys ADD CONSTRAINT management_keys_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.market_prices ADD CONSTRAINT market_prices_pkey PRIMARY KEY (model_id);
ALTER TABLE ONLY public.onboarding_events ADD CONSTRAINT onboarding_events_arch_check CHECK ((char_length(arch) <= 200));
ALTER TABLE ONLY public.onboarding_events ADD CONSTRAINT onboarding_events_gpu_check CHECK ((char_length(gpu) <= 200));
ALTER TABLE ONLY public.onboarding_events ADD CONSTRAINT onboarding_events_memory_gb_check CHECK ((char_length(memory_gb) <= 200));
ALTER TABLE ONLY public.onboarding_events ADD CONSTRAINT onboarding_events_message_check CHECK ((char_length(message) <= 500));
ALTER TABLE ONLY public.onboarding_events ADD CONSTRAINT onboarding_events_node_name_check CHECK ((char_length(node_name) <= 200));
ALTER TABLE ONLY public.onboarding_events ADD CONSTRAINT onboarding_events_os_check CHECK ((char_length(os) <= 200));
ALTER TABLE ONLY public.onboarding_events ADD CONSTRAINT onboarding_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.onboarding_events ADD CONSTRAINT onboarding_events_port_check CHECK ((char_length(port) <= 200));
ALTER TABLE ONLY public.onboarding_events ADD CONSTRAINT onboarding_events_runtime_check CHECK ((char_length(runtime) <= 200));
ALTER TABLE ONLY public.onboarding_events ADD CONSTRAINT onboarding_events_script_version_check CHECK ((char_length(script_version) <= 200));
ALTER TABLE ONLY public.onboarding_events ADD CONSTRAINT onboarding_events_status_check CHECK ((status = ANY (ARRAY['started'::text, 'warning'::text, 'failed'::text, 'stopped'::text, 'done'::text])));
ALTER TABLE ONLY public.onboarding_events ADD CONSTRAINT onboarding_events_step_check CHECK ((char_length(step) <= 200));
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_first_goal_check CHECK ((first_goal = ANY (ARRAY['look'::text, 'use'::text, 'own_machine'::text, 'share'::text])));
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_mail_language_check CHECK ((mail_language = ANY (ARRAY['en'::text, 'sv'::text])));
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_preferred_language_check CHECK ((preferred_language = ANY (ARRAY['en'::text, 'sv'::text])));
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_signup_intent_check CHECK (((signup_intent IS NULL) OR (signup_intent = ANY (ARRAY['buyer'::text, 'operator'::text]))));
ALTER TABLE ONLY public.signup_welcome_notices ADD CONSTRAINT signup_welcome_notices_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.support_messages ADD CONSTRAINT support_messages_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 4000)));
ALTER TABLE ONLY public.support_messages ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.support_messages ADD CONSTRAINT support_messages_sender_check CHECK ((sender = ANY (ARRAY['user'::text, 'admin'::text])));
ALTER TABLE ONLY public.support_prompt_days ADD CONSTRAINT support_prompt_days_pkey PRIMARY KEY (user_id, day);
ALTER TABLE ONLY public.support_threads ADD CONSTRAINT support_threads_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.support_threads ADD CONSTRAINT support_threads_status_check CHECK ((status = ANY (ARRAY['open'::text, 'answered'::text, 'closed'::text])));
ALTER TABLE ONLY public.support_threads ADD CONSTRAINT support_threads_tag_check CHECK ((tag = ANY (ARRAY['onboarding'::text, 'connect'::text, 'models'::text, 'billing'::text, 'chat'::text, 'other'::text])));
ALTER TABLE ONLY public.token_usage ADD CONSTRAINT token_usage_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

-- ======================================================================
-- Foreign keys (36)
-- ======================================================================
ALTER TABLE ONLY public.announcements ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE ONLY public.api_keys ADD CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.auto_route ADD CONSTRAINT auto_route_curated_model_id_fkey FOREIGN KEY (curated_model_id) REFERENCES curated_models(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.bridge_links ADD CONSTRAINT bridge_links_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.buyer_first_requests ADD CONSTRAINT buyer_first_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.credit_payment_reversals ADD CONSTRAINT credit_payment_reversals_session_id_fkey FOREIGN KEY (session_id) REFERENCES credit_transactions(stripe_session_id);
ALTER TABLE ONLY public.credit_transactions ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.customer_key_events ADD CONSTRAINT customer_key_events_management_key_id_fkey FOREIGN KEY (management_key_id) REFERENCES management_keys(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.customer_key_events ADD CONSTRAINT customer_key_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_country_history ADD CONSTRAINT garage_country_history_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_energy_daily ADD CONSTRAINT garage_energy_daily_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_energy_windows ADD CONSTRAINT garage_energy_windows_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_managed_models ADD CONSTRAINT garage_managed_models_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_model_failures ADD CONSTRAINT garage_model_failures_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_model_memory ADD CONSTRAINT garage_model_memory_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_model_tests ADD CONSTRAINT garage_model_tests_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_models ADD CONSTRAINT garage_models_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_region_events ADD CONSTRAINT garage_region_events_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_runtime_secrets ADD CONSTRAINT garage_runtime_secrets_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_smart_events ADD CONSTRAINT garage_smart_events_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_smart_events ADD CONSTRAINT garage_smart_events_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES profiles(id);
ALTER TABLE ONLY public.garage_status_samples ADD CONSTRAINT garage_status_samples_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_status_summary ADD CONSTRAINT garage_status_summary_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_terms_events ADD CONSTRAINT garage_terms_events_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garage_tokens ADD CONSTRAINT garage_tokens_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.garages ADD CONSTRAINT garages_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.mail_delivery_state ADD CONSTRAINT mail_delivery_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.mail_log ADD CONSTRAINT mail_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.management_keys ADD CONSTRAINT management_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.onboarding_events ADD CONSTRAINT onboarding_events_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.signup_welcome_notices ADD CONSTRAINT signup_welcome_notices_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.support_messages ADD CONSTRAINT support_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES support_threads(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.token_usage ADD CONSTRAINT token_usage_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.token_usage ADD CONSTRAINT token_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ======================================================================
-- Indexes (36)
-- ======================================================================
CREATE INDEX announcements_newest ON public.announcements USING btree (created_at DESC);
CREATE UNIQUE INDEX api_keys_litellm_alias_key ON public.api_keys USING btree (litellm_alias) WHERE (litellm_alias IS NOT NULL);
CREATE INDEX bridge_links_created_idx ON public.bridge_links USING btree (created_at);
CREATE INDEX bridge_links_ip_created_idx ON public.bridge_links USING btree (requested_ip_hash, created_at);
CREATE UNIQUE INDEX credit_transactions_event_id_unique ON public.credit_transactions USING btree (stripe_event_id) WHERE (stripe_event_id IS NOT NULL);
CREATE INDEX customer_key_events_user_idx ON public.customer_key_events USING btree (user_id, at DESC);
CREATE INDEX garage_country_history_garage_idx ON public.garage_country_history USING btree (garage_id, seen_at DESC);
CREATE INDEX garage_energy_daily_day_idx ON public.garage_energy_daily USING btree (day);
CREATE INDEX garage_energy_windows_at_idx ON public.garage_energy_windows USING btree (at);
CREATE INDEX garage_model_tests_garage_model_tested_idx ON public.garage_model_tests USING btree (garage_id, model, tested_at DESC);
CREATE INDEX garage_status_samples_garage_time_idx ON public.garage_status_samples USING btree (garage_id, sampled_at DESC);
CREATE INDEX garage_status_samples_time_idx ON public.garage_status_samples USING btree (sampled_at);
CREATE INDEX garage_terms_events_garage_idx ON public.garage_terms_events USING btree (garage_id, created_at DESC);
CREATE INDEX garage_tokens_garage_created_idx ON public.garage_tokens USING btree (garage_id, created_at);
CREATE INDEX garage_tokens_garage_id_idx ON public.garage_tokens USING btree (garage_id);
CREATE INDEX garages_last_heartbeat_at_idx ON public.garages USING btree (last_heartbeat_at) WHERE (last_heartbeat_at IS NOT NULL);
CREATE INDEX garages_operator_id_idx ON public.garages USING btree (operator_id);
CREATE INDEX idx_api_keys_user_id ON public.api_keys USING btree (user_id);
CREATE INDEX idx_api_keys_user_id_active ON public.api_keys USING btree (user_id, is_active) WHERE (is_active = true);
CREATE INDEX idx_api_keys_user_id_created_at ON public.api_keys USING btree (user_id, created_at DESC);
CREATE INDEX idx_chat_conversations_updated_at ON public.chat_conversations USING btree (updated_at DESC);
CREATE INDEX idx_chat_conversations_user_id ON public.chat_conversations USING btree (user_id);
CREATE INDEX idx_credit_transactions_user_id_created_at ON public.credit_transactions USING btree (user_id, created_at DESC);
CREATE INDEX idx_token_usage_api_key_id ON public.token_usage USING btree (api_key_id);
CREATE INDEX idx_token_usage_api_key_id_timestamp ON public.token_usage USING btree (api_key_id, "timestamp" DESC);
CREATE INDEX idx_token_usage_model ON public.token_usage USING btree (model);
CREATE INDEX idx_token_usage_timestamp ON public.token_usage USING btree ("timestamp");
CREATE INDEX idx_token_usage_user_id ON public.token_usage USING btree (user_id);
CREATE INDEX idx_token_usage_user_id_timestamp ON public.token_usage USING btree (user_id, "timestamp" DESC);
CREATE INDEX mail_log_created ON public.mail_log USING btree (created_at DESC);
CREATE UNIQUE INDEX mail_log_sent_event ON public.mail_log USING btree (user_id, template_key, event_ref) WHERE (status = 'sent'::text);
CREATE INDEX mail_log_user_created ON public.mail_log USING btree (user_id, created_at DESC);
CREATE INDEX management_keys_user_idx ON public.management_keys USING btree (user_id);
CREATE INDEX onboarding_events_garage_created_idx ON public.onboarding_events USING btree (garage_id, created_at DESC);
CREATE INDEX support_messages_thread ON public.support_messages USING btree (thread_id, created_at);
CREATE INDEX support_threads_user ON public.support_threads USING btree (user_id, created_at DESC);

-- ======================================================================
-- Triggers (24)
-- ======================================================================
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER validate_support_setting BEFORE INSERT OR UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION validate_support_setting();
CREATE TRIGGER api_keys_require_account_terms BEFORE INSERT ON public.api_keys FOR EACH ROW EXECUTE FUNCTION require_account_terms_for_insert();
CREATE TRIGGER guard_api_key_internal BEFORE INSERT OR UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION guard_api_key_internal();
CREATE TRIGGER bridge_links_transport_history BEFORE INSERT OR UPDATE OF transport ON public.bridge_links FOR EACH ROW EXECUTE FUNCTION guard_transport_history();
CREATE TRIGGER enforce_single_default_model BEFORE INSERT OR UPDATE ON public.curated_models FOR EACH ROW EXECUTE FUNCTION ensure_single_default_model();
CREATE TRIGGER garage_energy_window_aggregate AFTER INSERT ON public.garage_energy_windows FOR EACH ROW EXECUTE FUNCTION aggregate_garage_energy();
CREATE TRIGGER fill_garage_name BEFORE INSERT ON public.garage_model_stats_hourly FOR EACH ROW EXECUTE FUNCTION fill_ledger_garage_name();
CREATE TRIGGER garage_models_canonical BEFORE INSERT OR UPDATE ON public.garage_models FOR EACH ROW EXECUTE FUNCTION garage_models_canonical();
CREATE TRIGGER fill_garage_name BEFORE INSERT ON public.garage_price_history FOR EACH ROW EXECUTE FUNCTION fill_ledger_garage_name();
CREATE TRIGGER fill_garage_name BEFORE INSERT ON public.garage_request_stats_hourly FOR EACH ROW EXECUTE FUNCTION fill_ledger_garage_name();
CREATE TRIGGER garage_status_samples_rollup AFTER INSERT ON public.garage_status_samples FOR EACH ROW EXECUTE FUNCTION roll_garage_status_summary();
CREATE TRIGGER garages_audit_smart BEFORE UPDATE OF smart ON public.garages FOR EACH ROW EXECUTE FUNCTION garages_audit_smart();
CREATE TRIGGER garages_country_history AFTER UPDATE OF measured_country ON public.garages FOR EACH ROW EXECUTE FUNCTION record_garage_country();
CREATE TRIGGER garages_guard_canary BEFORE UPDATE OF canary ON public.garages FOR EACH ROW EXECUTE FUNCTION guard_garage_canary();
CREATE TRIGGER garages_require_account_terms BEFORE INSERT ON public.garages FOR EACH ROW EXECUTE FUNCTION require_account_terms_for_insert();
CREATE TRIGGER garages_transport_history BEFORE INSERT OR UPDATE OF transport ON public.garages FOR EACH ROW EXECUTE FUNCTION guard_transport_history();
CREATE TRIGGER record_garage_prices AFTER INSERT OR UPDATE ON public.garages FOR EACH ROW EXECUTE FUNCTION record_garage_prices();
CREATE TRIGGER update_garages_updated_at BEFORE UPDATE ON public.garages FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER profiles_guard_account_terms BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION guard_account_terms();
CREATE TRIGGER profiles_guard_mail_test BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION guard_mail_test();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER guard_support_message_off BEFORE INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION guard_support_off();
CREATE TRIGGER guard_support_thread_off BEFORE INSERT ON public.support_threads FOR EACH ROW EXECUTE FUNCTION guard_support_off();

-- ======================================================================
-- Row-level security (51)
-- ======================================================================
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_route ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bridge_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bridge_release_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_first_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_payment_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curated_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_garage_model_stats_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_garage_request_stats_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_key_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_country_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_energy_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_energy_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_managed_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_model_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_model_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_model_stats_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_model_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_region_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_request_stats_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_runtime_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_smart_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_status_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_status_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_terms_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_key_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_model_stats_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_delivery_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_worker_lock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_welcome_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_prompt_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ======================================================================
-- Policies (59)
-- ======================================================================
CREATE POLICY "Admins can manage settings" ON public.admin_settings AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anon can read site settings" ON public.admin_settings AS PERMISSIVE FOR SELECT TO anon
  USING ((key = 'site_settings'::text));
CREATE POLICY "Authenticated can read public settings" ON public.admin_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((key = ANY (ARRAY['site_settings'::text, 'chat_enabled_models'::text, 'chat_default_model'::text, 'demand_models'::text])));
CREATE POLICY "Public can read starter credit" ON public.admin_settings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((key = 'default_user_budget_usd'::text));
CREATE POLICY "Signed-in users can read Bridge update setting" ON public.admin_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((key = 'bridge_update'::text));
CREATE POLICY "Signed-in users can read Bridge version" ON public.admin_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((key = 'bridge_latest'::text));
CREATE POLICY "Signed-in users can read support availability" ON public.admin_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((key = 'support_chat'::text));
CREATE POLICY "Admins manage announcements" ON public.announcements AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Current audience announcements" ON public.announcements AS PERMISSIVE FOR SELECT TO authenticated
  USING (((starts_at <= now()) AND ((ends_at IS NULL) OR (ends_at > now())) AND ((audience = 'all'::text) OR ((audience = 'operators'::text) AND (EXISTS ( SELECT 1
   FROM garages g
  WHERE (g.operator_id = auth.uid())))) OR ((audience = 'buyers'::text) AND (NOT (EXISTS ( SELECT 1
   FROM garages g
  WHERE (g.operator_id = auth.uid()))))))));
CREATE POLICY "Users can update own API keys" ON public.api_keys AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own API keys" ON public.api_keys AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));
CREATE POLICY "Admins manage auto route" ON public.auto_route AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read bridge release runs" ON public.bridge_release_runs AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users read own first request" ON public.buyer_first_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));
CREATE POLICY "Users can delete own conversations" ON public.chat_conversations AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own conversations" ON public.chat_conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own conversations" ON public.chat_conversations AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own conversations" ON public.chat_conversations AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own transactions" ON public.credit_transactions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));
CREATE POLICY "Admins can manage curated models" ON public.curated_models AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can read curated models" ON public.curated_models AS PERMISSIVE FOR SELECT TO public
  USING (((COALESCE(garage_tier, ''::text) <> 'private'::text) AND (COALESCE(model_name, id) !~~ 'mine/%'::text) AND ((garage IS NULL) OR (garage_tier = 'auto'::text) OR market_garage_visible(garage))));
CREATE POLICY "Owners read own key events" ON public.customer_key_events AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));
CREATE POLICY "Admins read country history" ON public.garage_country_history AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY energy_daily_read ON public.garage_energy_daily AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM garages g
  WHERE ((g.id = garage_energy_daily.garage_id) AND (g.operator_id = auth.uid())))) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY energy_windows_read ON public.garage_energy_windows AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM garages g
  WHERE ((g.id = garage_energy_windows.garage_id) AND (g.operator_id = auth.uid())))) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Operators read own managed models" ON public.garage_managed_models AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM garages g
  WHERE ((g.id = garage_managed_models.garage_id) AND (g.operator_id = auth.uid())))) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins view garage model tests" ON public.garage_model_tests AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Operators view own garage model tests" ON public.garage_model_tests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM garages g
  WHERE ((g.id = garage_model_tests.garage_id) AND (g.operator_id = auth.uid())))));
CREATE POLICY "Admins manage garage models" ON public.garage_models AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Operators update own garage models" ON public.garage_models AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM garages g
  WHERE ((g.id = garage_models.garage_id) AND (g.operator_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM garages g
  WHERE ((g.id = garage_models.garage_id) AND (g.operator_id = auth.uid())))));
CREATE POLICY "Operators view own garage models" ON public.garage_models AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM garages g
  WHERE ((g.id = garage_models.garage_id) AND (g.operator_id = auth.uid())))));
CREATE POLICY "Admins read price history" ON public.garage_price_history AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read region events" ON public.garage_region_events AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Operators read Smart notices" ON public.garage_smart_events AS PERMISSIVE FOR SELECT TO authenticated
  USING ((operator_id = auth.uid()));
CREATE POLICY "Admins read provider terms events" ON public.garage_terms_events AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage garages" ON public.garages AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Operators view own garages" ON public.garages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((operator_id = auth.uid()));
CREATE POLICY gateway_key_records_admin ON public.gateway_key_records AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY internal_stats_admin ON public.internal_model_stats_hourly AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY mail_log_admin ON public.mail_log AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY mail_templates_admin ON public.mail_templates AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners read own management keys" ON public.management_keys AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));
CREATE POLICY "Anyone can read market prices" ON public.market_prices AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "Admins read all onboarding events" ON public.onboarding_events AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Operators read own onboarding events" ON public.onboarding_events AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM garages g
  WHERE ((g.id = onboarding_events.garage_id) AND (g.operator_id = auth.uid())))));
CREATE POLICY "Admins can view all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = id));
CREATE POLICY support_messages_read ON public.support_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM support_threads t
  WHERE ((t.id = support_messages.thread_id) AND ((t.user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))))));
CREATE POLICY support_prompt_read ON public.support_prompt_days AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));
CREATE POLICY support_threads_read ON public.support_threads AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Users can view own token usage" ON public.token_usage AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));
CREATE POLICY "Admins can manage roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));
CREATE POLICY "Admins can delete site assets" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'site-assets'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins can list site assets" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'site-assets'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins can update site assets" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'site-assets'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins can upload site assets" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'site-assets'::text) AND has_role(auth.uid(), 'admin'::app_role)));

-- ======================================================================
-- Realtime publication (0)
-- ======================================================================

-- ======================================================================
-- Storage buckets (1)
-- ======================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('site-assets', 'site-assets', true);

-- ======================================================================
-- Cron jobs (secrets redacted; URLs point at the Lovable Supabase project) (11)
-- ======================================================================
SELECT cron.schedule('check-bridge-release', '7 * * * *', ' select net.http_post(url:=''https://sjopaiquzqotymqmrcke.supabase.co/functions/v1/check-bridge-release'', headers:=jsonb_build_object(''Content-Type'',''application/json'',''x-cron-secret'',(select value from public.internal_secrets where name=''sync_models_cron_secret'')), body:=''{}''::jsonb); ');
SELECT cron.schedule('event-mail', '*/15 * * * *', '/* lovable:authenticated-cron:v1 */ SELECT net.http_post(url := ''https://sjopaiquzqotymqmrcke.supabase.co/functions/v1/event-mail'', headers := ''{"Authorization":"Bearer <REDACTED>","Content-Type":"application/json"}''::jsonb, body := ''{"action":"run"}''::jsonb);');
SELECT cron.schedule('fetch-market-prices', '17 3 * * *', ' select net.http_post(url:=''https://sjopaiquzqotymqmrcke.supabase.co/functions/v1/fetch-market-prices'', headers:=jsonb_build_object(''Content-Type'',''application/json'',''x-cron-secret'',(select value from public.internal_secrets where name=''sync_models_cron_secret'')), body:=''{}''::jsonb); ');
SELECT cron.schedule('garage-smart-nightly', '30 4 * * *', ' SELECT net.http_post(url:=''https://sjopaiquzqotymqmrcke.supabase.co/functions/v1/garage-smart-nightly'',headers:=jsonb_build_object(''Content-Type'',''application/json'',''x-cron-secret'',(SELECT value FROM public.internal_secrets WHERE name=''sync_models_cron_secret'')),body:=''{}''::jsonb) ');
SELECT cron.schedule('onboarding-events-retention', '40 2 * * *', 'SELECT public.prune_onboarding_events();');
SELECT cron.schedule('prune-chat-keys', '15 3 * * *', 'SELECT net.http_post(url:=''https://sjopaiquzqotymqmrcke.supabase.co/functions/v1/prune-chat-keys'',headers:=jsonb_build_object(''Content-Type'',''application/json'',''x-cron-secret'',(SELECT value FROM public.internal_secrets WHERE name=''sync_models_cron_secret'')),body:=''{}''::jsonb)');
SELECT cron.schedule('prune-closed-support', '20 3 * * *', 'SELECT public.prune_closed_support();');
SELECT cron.schedule('prune-cron-run-details', '17 3 * * *', 'DELETE FROM cron.job_run_details WHERE end_time < now() - interval ''7 days''');
SELECT cron.schedule('prune-garage-energy', '35 3 * * *', 'SELECT public.prune_garage_energy();');
SELECT cron.schedule('prune-garage-status-samples', '27 3 * * *', 'DELETE FROM public.garage_status_samples WHERE sampled_at < now() - interval ''30 days''');
SELECT cron.schedule('sync-models-every-5-min', '*/5 * * * *', '
  SELECT net.http_post(
    url := ''https://sjopaiquzqotymqmrcke.supabase.co/functions/v1/sync-models-cron'',
    headers := jsonb_build_object(''Content-Type'',''application/json'',''x-cron-secret'',
      (SELECT value FROM public.internal_secrets WHERE name = ''sync_models_cron_secret'')),
    body := ''{}''::jsonb
  );
');
