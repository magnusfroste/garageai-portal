-- Run transactionally: an "Only me" garage's probe row is visible to its owner only.
BEGIN;
DO $$
DECLARE owner uuid; other uuid; g uuid; owner_rows int; anon_rows int;
BEGIN
  SELECT operator_id INTO owner FROM public.garages WHERE visibility = 'private' LIMIT 1;
  IF owner IS NULL THEN
    SELECT operator_id INTO owner FROM public.garages WHERE connection_type <> 'endpoint' LIMIT 1;
    UPDATE public.garages SET visibility = 'private' WHERE operator_id = owner RETURNING id INTO g;
  ELSE
    SELECT id INTO g FROM public.garages WHERE operator_id = owner AND visibility = 'private' LIMIT 1;
  END IF;
  SELECT id INTO other FROM auth.users WHERE id <> owner LIMIT 1;
  IF other IS NULL THEN RAISE EXCEPTION 'A second user is required for this test'; END IF;

  INSERT INTO public.garage_model_tests (garage_id, model, supports_tools, tested_at)
  VALUES (g, 'fixture/mine-tools', true, now());

  -- Owner sees the private garage's row.
  EXECUTE format('SET LOCAL request.jwt.claims = %L', json_build_object('sub', owner, 'role', 'authenticated')::text);
  SELECT count(*) INTO owner_rows FROM public.garage_tool_support() WHERE model = 'fixture/mine-tools';
  IF owner_rows <> 1 THEN RAISE EXCEPTION 'Owner cannot see own private garage tool support'; END IF;

  -- Another authenticated user does not.
  EXECUTE format('SET LOCAL request.jwt.claims = %L', json_build_object('sub', other, 'role', 'authenticated')::text);
  SELECT count(*) INTO anon_rows FROM public.garage_tool_support() WHERE model = 'fixture/mine-tools';
  IF anon_rows <> 0 THEN RAISE EXCEPTION 'Private garage tool support leaked to another user'; END IF;
END $$;
ROLLBACK;
