CREATE OR REPLACE FUNCTION public.guard_support_off() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF public.support_availability()->>'mode'='off' THEN
  IF TG_TABLE_NAME='support_threads' THEN RAISE EXCEPTION 'Support chat is currently off. You can still read existing replies from Account.';
  ELSIF NEW.sender='user' THEN RAISE EXCEPTION 'Support chat is currently off. You can still read existing replies from Account.';
  END IF;
 END IF; RETURN NEW;
END $$;