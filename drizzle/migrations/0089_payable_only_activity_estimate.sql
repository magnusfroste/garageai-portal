CREATE OR REPLACE FUNCTION public.operator_garage_activity() RETURNS TABLE(garage_id uuid,period text,requests bigint,prompt_tokens bigint,completion_tokens bigint,recorded_spend numeric,estimated_earnings numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH r AS (
SELECT g.id gid,w.period,s.payable_requests preq,s.payable_spend_usd pay,
 CASE WHEN coalesce(s.spend_usd,0)>0 THEN s.payable_spend_usd/s.spend_usd ELSE 0 END share,
 s.prompt_tokens pt,s.completion_tokens ct,
 ((s.prompt_tokens-s.dedicated_prompt_tokens)*coalesce(m.pool_input_cost_per_million,g.pool_input_cost_per_million)+s.dedicated_prompt_tokens*coalesce(m.dedicated_input_cost_per_million,g.dedicated_input_cost_per_million)+(s.completion_tokens-s.dedicated_completion_tokens)*coalesce(m.pool_output_cost_per_million,g.pool_output_cost_per_million)+s.dedicated_completion_tokens*coalesce(m.dedicated_output_cost_per_million,g.dedicated_output_cost_per_million))/1000000 est
FROM garages g CROSS JOIN(VALUES('7d',interval '7 days'),('30d',interval '30 days')) w(period,span) LEFT JOIN garage_model_stats_hourly s ON s.garage_id=g.id AND s.hour>=now()-w.span LEFT JOIN garage_models m ON m.garage_id=s.garage_id AND regexp_replace(m.model,'[^A-Za-z0-9._-]','-','g')=s.model WHERE g.operator_id=auth.uid() OR public.has_role(auth.uid(),'admin'))
SELECT gid,period,coalesce(sum(preq),0)::bigint,coalesce(round(sum(pt*share)),0)::bigint,coalesce(round(sum(ct*share)),0)::bigint,coalesce(sum(pay),0),coalesce(sum(least(coalesce(est,0)*share,pay)),0)
FROM r GROUP BY gid,period $$;