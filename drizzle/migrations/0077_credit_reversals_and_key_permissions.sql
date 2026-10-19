DROP POLICY IF EXISTS "Users can insert own API keys" ON public.api_keys;
REVOKE INSERT, UPDATE ON public.api_keys FROM authenticated, anon;
REVOKE UPDATE (name, is_active, revoked_at) ON public.api_keys FROM authenticated;
GRANT UPDATE (name) ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS stripe_event_id text;
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS original_session_id text;
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS stripe_charge_id text;
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_event_id_unique ON public.credit_transactions(stripe_event_id) WHERE stripe_event_id IS NOT NULL;

CREATE TABLE public.credit_payment_reversals (
 session_id text PRIMARY KEY REFERENCES public.credit_transactions(stripe_session_id),
 charge_id text NOT NULL,
 charged_minor bigint NOT NULL CHECK (charged_minor > 0),
 refunded_minor bigint NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0),
 disputed_minor bigint NOT NULL DEFAULT 0 CHECK (disputed_minor >= 0),
 reversed_credits numeric NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.credit_payment_reversals TO service_role;
ALTER TABLE public.credit_payment_reversals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apply_credit_reversal(_event_id text, _session_id text, _charge_id text, _charged_minor bigint, _refunded_minor bigint, _disputed_minor bigint, _reason text)
RETURNS TABLE(user_id uuid, credits_delta numeric, already_processed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.apply_credit_reversal(text,text,text,bigint,bigint,bigint,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_credit_reversal(text,text,text,bigint,bigint,bigint,text) TO service_role;