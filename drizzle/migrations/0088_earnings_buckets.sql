-- Earnings buckets: only requests other users paid for with purchased credit earn.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['garage_request_stats_hourly','customer_garage_request_stats_hourly','garage_model_stats_hourly','customer_garage_model_stats_hourly'] LOOP
    EXECUTE format('ALTER TABLE public.%I
      ADD COLUMN IF NOT EXISTS payable_spend_usd numeric NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS trial_spend_usd numeric NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS own_spend_usd numeric NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payable_requests integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS trial_requests integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS own_requests integer NOT NULL DEFAULT 0', t);
  END LOOP;
END $$;
ALTER TABLE public.garage_request_stats_hourly ADD COLUMN IF NOT EXISTS buyer_users uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.customer_garage_request_stats_hourly ADD COLUMN IF NOT EXISTS buyer_users uuid[] NOT NULL DEFAULT '{}';

-- Operator overview: earned = payable only; trial/own request counts shown separately.
CREATE OR REPLACE FUNCTION public.operator_garage_overview(_garage_id uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ WITH own AS(SELECT id FROM garages WHERE id=_garage_id AND operator_id=auth.uid()),ledger AS(SELECT h.* FROM public.garage_request_stats_hourly h JOIN own ON own.id=h.garage_id),s AS(SELECT h.* FROM customer_garage_request_stats_hourly h JOIN own ON own.id=h.garage_id),m AS(SELECT h.model,sum(h.requests) requests FROM customer_garage_model_stats_hourly h JOIN own ON own.id=h.garage_id WHERE h.hour>=date_trunc('week',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' GROUP BY h.model) SELECT CASE WHEN EXISTS(SELECT 1 FROM own) THEN jsonb_build_object('today',coalesce((SELECT sum(payable_spend_usd) FROM ledger WHERE hour>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0),'week',coalesce((SELECT sum(payable_spend_usd) FROM ledger WHERE hour>=date_trunc('week',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0),'total',coalesce((SELECT sum(payable_spend_usd) FROM ledger),0),'trial_requests',coalesce((SELECT sum(trial_requests) FROM ledger),0),'own_requests',coalesce((SELECT sum(own_requests) FROM ledger),0),'last_request_at',(SELECT max(last_request_at) FROM s WHERE requests>0),'last_request_hour',(SELECT max(hour) FROM s WHERE requests>0),'response_ms',(SELECT percentile_cont(0.5) WITHIN GROUP(ORDER BY ttft_ms_p50) FROM s WHERE hour>=now()-interval '7 days' AND ttft_ms_p50>0),'daily',(SELECT jsonb_agg(jsonb_build_object('day',d.day::date,'requests',coalesce((SELECT sum(requests) FROM s WHERE hour>=d.day AND hour<d.day+interval '1 day'),0),'earned',coalesce((SELECT sum(payable_spend_usd) FROM ledger WHERE hour>=d.day AND hour<d.day+interval '1 day'),0)) ORDER BY d.day) FROM generate_series(date_trunc('day',now() AT TIME ZONE 'UTC')-interval '13 days',date_trunc('day',now() AT TIME ZONE 'UTC'),interval '1 day') d(day)),'models',coalesce((SELECT jsonb_agg(jsonb_build_object('model',model,'requests',requests)) FROM m),'[]'::jsonb)) END $function$;

-- Admin: earnings buckets of one garage in a window, to check a payout claim at a glance.
CREATE OR REPLACE FUNCTION public.garage_earning_buckets(_garage_id uuid, _from timestamptz, _to timestamptz)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT jsonb_build_object(
    'payable_spend_usd', coalesce(sum(payable_spend_usd),0), 'trial_spend_usd', coalesce(sum(trial_spend_usd),0), 'own_spend_usd', coalesce(sum(own_spend_usd),0),
    'payable_requests', coalesce(sum(payable_requests),0), 'trial_requests', coalesce(sum(trial_requests),0), 'own_requests', coalesce(sum(own_requests),0),
    'total_spend_usd', coalesce(sum(spend_usd),0), 'requests', coalesce(sum(requests),0),
    'buyer_users', (SELECT count(DISTINCT u) FROM garage_request_stats_hourly h2, unnest(h2.buyer_users) u WHERE h2.garage_id=_garage_id AND h2.hour>=_from AND h2.hour<_to))
  FROM garage_request_stats_hourly WHERE garage_id=_garage_id AND hour>=_from AND hour<_to);
END $function$;
REVOKE ALL ON FUNCTION public.garage_earning_buckets(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garage_earning_buckets(uuid, timestamptz, timestamptz) TO authenticated;
