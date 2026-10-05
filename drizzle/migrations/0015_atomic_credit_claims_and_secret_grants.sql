GRANT ALL ON TABLE public.garage_runtime_secrets TO service_role;
REVOKE ALL ON TABLE public.garage_runtime_secrets FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_checkout_credits(
  p_session_id text,
  p_user_id uuid,
  p_credits numeric
)
RETURNS TABLE (credits_added numeric, already_processed boolean, total_budget numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.claim_checkout_credits(text, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_checkout_credits(text, uuid, numeric) TO service_role;