-- CRITICAL FIX: the protect_privileged_profile_columns trigger added in
-- 20260722000000_verified_badge_and_column_protection.sql resets `points`
-- back to its old value on any UPDATE to profiles where the *calling*
-- user is not an admin. That was meant to stop a student directly calling
-- `profiles.update({points: 999999})` from the browser console.
--
-- It had an unintended side effect that has been silently active since
-- that migration was applied: award_points() — the function every normal
-- point-earning action goes through (posting +5, commenting +2, getting a
-- reaction +1, being reported -20) — runs as SECURITY DEFINER but auth.uid()
-- inside it still resolves to the original acting student, not an admin.
-- So the protect trigger was cancelling every single automatic point award
-- for every non-admin user. Nobody but admins has been able to accumulate
-- points since that migration.
--
-- It also silently cancelled the brand-new auto-verify-at-1000-points
-- trigger (20260721000326_...) for the same reason: verified would flip to
-- true, then immediately get reset back to its old value one trigger later.
--
-- Fix: give trusted, server-side point-award paths a way to mark their own
-- update as trusted (a transaction-local Postgres setting), and have the
-- protect trigger let those through untouched, while still fully blocking a
-- direct client-issued `.update({points: ...})` call, which never sets this
-- flag.

CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin')
     OR current_setting('app.trusted_profile_update', true) = 'on' THEN
    RETURN NEW;
  END IF;

  NEW.points := OLD.points;
  NEW.banned := OLD.banned;
  NEW.suspended_until := OLD.suspended_until;
  NEW.warning_count := OLD.warning_count;
  NEW.must_change_password := OLD.must_change_password;
  NEW.email := OLD.email;
  NEW.verified := OLD.verified;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_points(_user UUID, _delta INTEGER)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.trusted_profile_update', 'on', true); -- true = transaction-local, auto-resets
  UPDATE public.profiles SET points = GREATEST(0, points + _delta), updated_at = now() WHERE id = _user;
END;
$$;
