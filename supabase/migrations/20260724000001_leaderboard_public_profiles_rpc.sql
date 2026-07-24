-- FIX: leaderboard.tsx queried `profiles` directly (select *), which since
-- profiles_select_self_or_admin now restricts SELECT to own-row-or-admin,
-- meant a regular user's leaderboard only ever showed their own row.
-- New safe RPC returns public-only columns for everyone (optionally
-- filtered), matching the pattern of the existing get_public_profiles.

CREATE OR REPLACE FUNCTION public.list_public_profiles(
  _major public.major_code DEFAULT NULL,
  _year smallint DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text,
  major public.major_code,
  year smallint,
  points integer,
  verified boolean,
  university_number text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id, full_name, avatar_url, major, year, points, verified, university_number
  FROM public.profiles
  WHERE banned = false
    AND (_major IS NULL OR major = _major)
    AND (_year IS NULL OR year = _year)
  ORDER BY points DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_public_profiles(public.major_code, smallint) TO authenticated;
