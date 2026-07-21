
CREATE OR REPLACE FUNCTION public.auto_verify_on_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.points >= 1000 AND COALESCE(OLD.verified, false) = false AND NEW.verified = COALESCE(OLD.verified, false) THEN
    NEW.verified := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_verify_on_points ON public.profiles;
CREATE TRIGGER trg_auto_verify_on_points
BEFORE UPDATE OF points ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.auto_verify_on_points();

UPDATE public.profiles SET verified = true WHERE points >= 1000 AND verified = false;
