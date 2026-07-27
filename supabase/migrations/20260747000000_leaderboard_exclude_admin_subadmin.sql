-- Exclude both admin AND sub_admin from leaderboard
CREATE OR REPLACE FUNCTION public.get_leaderboard_profiles(
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
  university_number text,
  verified boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, 
    p.full_name, 
    p.avatar_url, 
    p.major, 
    p.year, 
    p.points, 
    CASE WHEN p.hide_university_number THEN NULL ELSE p.university_number END AS university_number,
    p.verified
  FROM public.profiles p
  WHERE (_major IS NULL OR p.major = _major)
    AND (_year IS NULL OR p.year = _year)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = p.id 
      AND ur.role IN ('admin', 'sub_admin')
    )
  ORDER BY p.points DESC
  LIMIT 50;
END; $$;
