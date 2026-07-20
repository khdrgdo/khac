-- 1) Close a privilege-escalation gap: profiles_update_self only checks row
-- ownership (auth.uid() = id), not which columns are being changed. As
-- written, any authenticated user can self-update points, banned,
-- suspended_until, warning_count, must_change_password, or email directly
-- via the client, bypassing every admin_* RPC. A BEFORE UPDATE trigger is
-- used instead of rewriting the RLS policy because it also protects against
-- direct table updates issued through any future code path, not just the
-- current one, and it does not interfere with the existing admin_* RPCs
-- (they run as SECURITY DEFINER but auth.uid() still resolves to the real
-- calling admin's session, so has_role() below correctly allows their writes).
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.points := OLD.points;
    NEW.banned := OLD.banned;
    NEW.suspended_until := OLD.suspended_until;
    NEW.warning_count := OLD.warning_count;
    NEW.must_change_password := OLD.must_change_password;
    NEW.email := OLD.email;
    NEW.verified := OLD.verified;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_privileged_profile_columns ON public.profiles;
CREATE TRIGGER trg_protect_privileged_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_privileged_profile_columns();

-- 2) Verified badge column. Defaults false; only settable by admins (enforced
-- above) or the admin_set_verified RPC below (also admin-only).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

-- 3) Admin-only RPC to toggle verification, logged to admin_actions like
-- every other moderation action.
CREATE OR REPLACE FUNCTION public.admin_set_verified(_user uuid, _verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.profiles SET verified = _verified WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
  VALUES (auth.uid(), _user, CASE WHEN _verified THEN 'verify' ELSE 'unverify' END, NULL);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_verified(uuid, boolean) TO authenticated;

-- 4) Expose verified through the safe cross-user profile reader so posts,
-- comments, and profile pages can render the badge without needing direct
-- table access (profiles SELECT is locked to self-or-admin as of the prior
-- migration).
CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text,
  major public.major_code,
  year smallint,
  bio text,
  points integer,
  university_number text,
  verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.major, p.year, p.bio, p.points, p.university_number, p.verified
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
$$;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;
