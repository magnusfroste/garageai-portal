-- Run transactionally against an existing grant: every fixture change is rolled back.
BEGIN;
DO $$
DECLARE purchase public.credit_transactions; initial numeric; current_balance numeric; result record;
BEGIN
 SELECT * INTO purchase FROM public.credit_transactions WHERE stripe_session_id IS NOT NULL ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF purchase.id IS NULL THEN RAISE EXCEPTION 'A checkout grant is required for this rollback-only test'; END IF;
 SELECT purchased_credits_usd INTO initial FROM public.profiles WHERE id=purchase.user_id FOR UPDATE;
 SELECT * INTO result FROM public.apply_credit_reversal('evt_fixture_refund',purchase.stripe_session_id,'ch_fixture',2000,500,NULL,'refund');
 IF result.credits_delta IS DISTINCT FROM -purchase.credits_added/4 THEN RAISE EXCEPTION 'Partial refund mismatch'; END IF;
 SELECT * INTO result FROM public.apply_credit_reversal('evt_fixture_refund',purchase.stripe_session_id,'ch_fixture',2000,500,NULL,'refund');
 IF NOT result.already_processed OR result.credits_delta<>0 THEN RAISE EXCEPTION 'Duplicate event changed balance'; END IF;
 SELECT * INTO result FROM public.apply_credit_reversal('evt_fixture_dispute',purchase.stripe_session_id,'ch_fixture',2000,500,2000,'dispute_created');
 SELECT purchased_credits_usd INTO current_balance FROM public.profiles WHERE id=purchase.user_id;
 IF current_balance IS DISTINCT FROM initial-purchase.credits_added THEN RAISE EXCEPTION 'Full reversal clamped or overlap over-debited'; END IF;
 SELECT * INTO result FROM public.apply_credit_reversal('evt_fixture_won',purchase.stripe_session_id,'ch_fixture',2000,500,0,'dispute_won');
 IF result.credits_delta IS DISTINCT FROM purchase.credits_added*3/4 THEN RAISE EXCEPTION 'Won dispute restored refunded credit'; END IF;
 SELECT * INTO result FROM public.apply_credit_reversal('evt_fixture_stale_refund',purchase.stripe_session_id,'ch_fixture',2000,0,NULL,'refund');
 IF result.credits_delta<>0 THEN RAISE EXCEPTION 'Stale refund restored credits'; END IF;
 IF has_table_privilege('authenticated','public.api_keys','INSERT') THEN RAISE EXCEPTION 'Authenticated INSERT is permitted'; END IF;
 IF has_column_privilege('authenticated','public.api_keys','is_active','UPDATE') THEN RAISE EXCEPTION 'Reactivation is permitted'; END IF;
 IF has_column_privilege('authenticated','public.api_keys','revoked_at','UPDATE') THEN RAISE EXCEPTION 'Revocation timestamp is editable'; END IF;
 IF NOT has_column_privilege('authenticated','public.api_keys','name','UPDATE') THEN RAISE EXCEPTION 'Rename not permitted'; END IF;
 IF has_function_privilege('authenticated','public.apply_credit_reversal(text,text,text,bigint,bigint,bigint,text)','EXECUTE') THEN RAISE EXCEPTION 'User can forge reversal'; END IF;
END $$;
ROLLBACK;