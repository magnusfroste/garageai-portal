-- Transactional live checks; no test records remain.
BEGIN;
CREATE TEMP TABLE support_test_state(k text PRIMARY KEY,v uuid);
GRANT ALL ON support_test_state TO authenticated;
INSERT INTO support_test_state SELECT 'owner',id FROM public.profiles WHERE NOT public.has_role(id,'admin') ORDER BY created_at LIMIT 1;
INSERT INTO support_test_state SELECT 'other',id FROM public.profiles WHERE NOT public.has_role(id,'admin') AND id<>(SELECT v FROM support_test_state WHERE k='owner') ORDER BY created_at LIMIT 1;
INSERT INTO support_test_state SELECT 'admin',user_id FROM public.user_roles WHERE role='admin' LIMIT 1;
DO $$ BEGIN IF (SELECT count(*) FROM support_test_state)<>3 THEN RAISE EXCEPTION 'Requires two users and one admin'; END IF; END $$;
-- Isolate limits from any real threads within this rolled-back transaction.
UPDATE public.support_threads SET status='closed',closed_at=now(),created_at=now()-interval '2 days' WHERE user_id=(SELECT v FROM support_test_state WHERE k='owner');
DELETE FROM public.support_prompt_days WHERE user_id=(SELECT v FROM support_test_state WHERE k='owner');
SELECT set_config('request.jwt.claim.sub',(SELECT v::text FROM support_test_state WHERE k='owner'),true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE tid uuid; n int; ctx jsonb; i int; rejected boolean; BEGIN
  tid:=public.support_send('fixture support message',NULL,'{"page":"/dashboard/chat?key=sk-hidden","step":"runtime","last_error":"Bearer sk-sensitive","messages":["never attach"],"key":"sk-secret"}'::jsonb,'connect');
  INSERT INTO support_test_state VALUES('thread',tid);
  SELECT context INTO ctx FROM public.support_messages WHERE thread_id=tid;
  IF ctx ? 'messages' OR ctx ? 'key' OR ctx::text LIKE '%sk-%' OR ctx->>'page'<>'/dashboard/chat' THEN RAISE EXCEPTION 'Unsafe context'; END IF;
  IF NOT public.support_claim_prompt() OR public.support_claim_prompt() THEN RAISE EXCEPTION 'Daily prompt not enforced'; END IF;
  rejected:=false; BEGIN PERFORM public.support_send(repeat('a',4001),tid); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION '4000 character cap missing'; END IF;
  PERFORM public.support_manage(tid,'closed');
  FOR i IN 2..5 LOOP tid:=public.support_send('fixture thread'); PERFORM public.support_manage(tid,'closed'); END LOOP;
  rejected:=false; BEGIN PERFORM public.support_send('sixth thread'); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Five threads per day missing'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT v::text FROM support_test_state WHERE k='other'),true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; rejected boolean:=false; BEGIN
 SELECT count(*) INTO n FROM public.support_threads WHERE id=(SELECT v FROM support_test_state WHERE k='thread'); IF n<>0 THEN RAISE EXCEPTION 'Thread leaked to another user'; END IF;
 SELECT count(*) INTO n FROM public.support_messages WHERE thread_id=(SELECT v FROM support_test_state WHERE k='thread'); IF n<>0 THEN RAISE EXCEPTION 'Messages leaked'; END IF;
 BEGIN PERFORM public.support_send('forged reply',(SELECT v FROM support_test_state WHERE k='thread'),NULL,'other',true); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Forged admin permitted'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT v::text FROM support_test_state WHERE k='admin'),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.support_threads WHERE id=(SELECT v FROM support_test_state WHERE k='thread')) THEN RAISE EXCEPTION 'Admin cannot read'; END IF;
 PERFORM public.support_send('fixture admin reply',(SELECT v FROM support_test_state WHERE k='thread'),NULL,'connect',true);
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ DECLARE s jsonb; BEGIN
 s:=public.support_stats();
 IF NOT (s ? 'open' AND s ? 'waiting' AND s ? 'median_first_response_minutes_30d') THEN RAISE EXCEPTION 'Wrong support shape'; END IF;
 IF s::text LIKE '%fixture%' OR s::text LIKE '%email%' OR s::text LIKE '%body%' OR s::text LIKE '%@%' THEN RAISE EXCEPTION 'Support stats exposed content'; END IF;
END $$;
RESET ROLE;
ROLLBACK;