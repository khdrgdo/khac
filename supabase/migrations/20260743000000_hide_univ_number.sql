
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
    p.bio, 
    p.points, 
    CASE WHEN p.hide_university_number THEN NULL ELSE p.university_number END AS university_number,
    p.verified
  FROM public.profiles p
  LEFT JOIN public.user_roles r ON p.id = r.user_id AND r.role = 'sub_admin'
  WHERE p.id = ANY(_ids)
    -- Same hiding logic as the previous migration
    AND (
      r.user_id IS NULL 
      OR p.id = auth.uid() 
      OR public.has_role('admin', auth.uid())
    );
END; $$;

CREATE OR REPLACE FUNCTION public.search_public_profiles(_q text)
RETURNS TABLE(id uuid, full_name text, university_number text, avatar_url text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, 
    p.full_name, 
    CASE WHEN p.hide_university_number THEN NULL ELSE p.university_number END AS university_number, 
    p.avatar_url
  FROM public.profiles p
  LEFT JOIN public.user_roles r ON p.id = r.user_id AND r.role = 'sub_admin'
  WHERE (p.full_name ILIKE '%' || _q || '%' OR p.university_number ILIKE '%' || _q || '%')
    AND (
      r.user_id IS NULL 
      OR p.id = auth.uid() 
      OR public.has_role('admin', auth.uid())
    )
  LIMIT 20;
END; $$;

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
  LEFT JOIN public.user_roles r ON p.id = r.user_id AND r.role = 'sub_admin'
  WHERE (_major IS NULL OR p.major = _major)
    AND (_year IS NULL OR p.year = _year)
    AND (
      r.user_id IS NULL 
      OR p.id = auth.uid() 
      OR public.has_role('admin', auth.uid())
    )
  ORDER BY p.points DESC
  LIMIT 50;
END; $$;

