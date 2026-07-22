-- Migration to add get_leaderboard_profiles RPC function
-- Allows all authenticated users to view public leaderboard profiles without exposing sensitive columns like email/banned/warning_count.
-- Excludes admins from the leaderboard as requested.

CREATE OR REPLACE FUNCTION public.get_leaderboard_profiles(
  _major text DEFAULT NULL,
  _year integer DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text,
  major public.major_code,
  year smallint,
  points integer,
  university_number text,
  verified boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name, p.avatar_url, p.major, p.year, p.points, p.university_number, p.verified
  FROM public.profiles p
  WHERE p.banned = false
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.role = 'admin'
    )
    AND (_major IS NULL OR _major = 'all' OR p.major::text = _major)
    AND (_year IS NULL OR _year = 0 OR p.year = _year)
  ORDER BY p.points DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_profiles(text, integer) TO authenticated;
