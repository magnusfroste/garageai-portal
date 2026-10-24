-- Rollback-only energy window, daily ratio and access-isolation checks.
BEGIN;
CREATE TEMP TABLE energy_test_state(k text PRIMARY KEY,v uuid);
GRANT SELECT ON energy_test_state TO authenticated;
INSERT INTO energy_test_state SELECT 'owner',id FROM public.profiles WHERE NOT public.has_role(id,'admin') ORDER BY created_at LIMIT 1;
INSERT INTO energy_test_state SELECT 'other',id FROM public.profiles WHERE NOT public.has_role(id,'admin') AND id<>(SELECT v FROM energy_test_state WHERE k='owner') ORDER BY created_at LIMIT 1;
INSERT INTO energy_test_state SELECT 'admin',user_id FROM public.user_roles WHERE role='admin' LIMIT 1;
INSERT INTO energy_test_state VALUES ('garage',gen_random_uuid());
DO $$ BEGIN IF (SELECT count(*) FROM energy_test_state)<>4 THEN RAISE EXCEPTION 'Requires owner, other and admin'; END IF; END $$;
INSERT INTO public.garages(id,name,operator_id) SELECT v,'energy-rollback-fixture',(SELECT v FROM energy_test_state WHERE k='owner') FROM energy_test_state WHERE k='garage';
INSERT INTO public.garage_energy_windows(garage_id,at,window_min,source,wh,busy_wh,in_tokens,out_tokens,models)
SELECT v,now(),5,'nvidia-smi',3.21,1.05,12000,2400,'[{"model":"qwen3:4b","out_tokens":2400,"busy_wh":1.05,"tokens_per_kwh":2285714}]' FROM energy_test_state WHERE k='garage';
DO $$ DECLARE ratio numeric; BEGIN
 IF (SELECT count(*) FROM public.garage_energy_windows WHERE garage_id=(SELECT v FROM energy_test_state WHERE k='garage'))<>1 THEN RAISE EXCEPTION 'Sample window not stored exactly once'; END IF;
 SELECT tokens_per_kwh INTO ratio FROM public.garage_energy_daily WHERE garage_id=(SELECT v FROM energy_test_state WHERE k='garage') AND model='qwen3:4b';
 IF abs(ratio-2400/(1.05/1000))>0.001 THEN RAISE EXCEPTION 'Daily ratio must use busy Wh'; END IF;
END $$;
-- A second differently sized window must yield a ratio of sums, not average ratios.
INSERT INTO public.garage_energy_windows(garage_id,at,wh,busy_wh,out_tokens,source,models)
SELECT v,now()+interval '5 minutes',10,3,3000,'nvidia-smi','[{"model":"qwen3:4b","out_tokens":3000,"busy_wh":3}]' FROM energy_test_state WHERE k='garage';
DO $$ DECLARE ratio numeric; BEGIN
 SELECT tokens_per_kwh INTO ratio FROM public.garage_energy_daily WHERE garage_id=(SELECT v FROM energy_test_state WHERE k='garage') AND model='qwen3:4b';
 IF abs(ratio-5400/(4.05/1000))>0.001 THEN RAISE EXCEPTION 'Daily weighted ratio incorrect'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT v::text FROM energy_test_state WHERE k='owner'),true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE rejected boolean:=false; BEGIN
 IF (SELECT count(*) FROM public.garage_energy_windows WHERE garage_id=(SELECT v FROM energy_test_state WHERE k='garage'))<>2 THEN RAISE EXCEPTION 'Owner cannot read'; END IF;
 IF public.garage_energy_summary((SELECT v FROM energy_test_state WHERE k='garage')) IS NULL THEN RAISE EXCEPTION 'Owner summary unavailable'; END IF;
 BEGIN INSERT INTO public.garage_energy_windows(garage_id) SELECT v FROM energy_test_state WHERE k='garage'; EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'User could write energy'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT v::text FROM energy_test_state WHERE k='other'),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.garage_energy_windows WHERE garage_id=(SELECT v FROM energy_test_state WHERE k='garage')) THEN RAISE EXCEPTION 'Windows leaked'; END IF;
 IF EXISTS(SELECT 1 FROM public.garage_energy_daily WHERE garage_id=(SELECT v FROM energy_test_state WHERE k='garage')) THEN RAISE EXCEPTION 'Daily energy leaked'; END IF;
 IF public.garage_energy_summary((SELECT v FROM energy_test_state WHERE k='garage')) IS NOT NULL THEN RAISE EXCEPTION 'Summary leaked'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT v::text FROM energy_test_state WHERE k='admin'),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF (SELECT count(*) FROM public.garage_energy_windows WHERE garage_id=(SELECT v FROM energy_test_state WHERE k='garage'))<>2 THEN RAISE EXCEPTION 'Admin cannot read'; END IF; END $$;
RESET ROLE;
ROLLBACK;