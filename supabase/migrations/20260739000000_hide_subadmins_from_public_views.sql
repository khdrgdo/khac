-- Recreate list_public_profiles to exclude sub-admins from leaderboard unless the caller is the main admin
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
  SELECT p.id, p.full_name, p.avatar_url, p.major, p.year, p.points, p.verified, p.university_number
  FROM public.profiles p
  WHERE p.banned = false
    AND (_major IS NULL OR p.major = _major)
    AND (_year IS NULL OR p.year = _year)
    AND (
      p.id = auth.uid()
      OR public.is_main_admin(auth.uid())
      OR NOT (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'sub_admin')
        OR COALESCE(p.university_number, '') LIKE 'sub_%'
        OR COALESCE(p.university_number, '') LIKE 'SUBADMIN_%'
        OR COALESCE(p.email, '') LIKE '%@subadmin.%'
        OR LOWER(COALESCE(p.full_name, '')) LIKE '%a guard%'
      )
    )
  ORDER BY p.points DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_public_profiles(public.major_code, smallint) TO authenticated;

-- Recreate search_public_profiles to exclude sub-admins from searches unless the caller is the main admin
CREATE OR REPLACE FUNCTION public.search_public_profiles(_q text)
RETURNS TABLE(id uuid, full_name text, university_number text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.university_number, p.avatar_url
  FROM public.profiles p
  WHERE (p.full_name ILIKE '%'||_q||'%' OR p.university_number ILIKE '%'||_q||'%')
    AND (
      p.id = auth.uid()
      OR public.is_main_admin(auth.uid())
      OR NOT (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'sub_admin')
        OR COALESCE(p.university_number, '') LIKE 'sub_%'
        OR COALESCE(p.university_number, '') LIKE 'SUBADMIN_%'
        OR COALESCE(p.email, '') LIKE '%@subadmin.%'
        OR LOWER(COALESCE(p.full_name, '')) LIKE '%a guard%'
      )
    )
  LIMIT 15;
$$;

GRANT EXECUTE ON FUNCTION public.search_public_profiles(text) TO authenticated;

-- Recreate get_public_profiles to exclude sub-admins from detail fetch queries unless the caller is the main admin
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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name, p.avatar_url, p.major, p.year, p.bio, p.points, p.university_number, p.verified
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND (
      p.id = auth.uid()
      OR public.is_main_admin(auth.uid())
      OR NOT (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'sub_admin')
        OR COALESCE(p.university_number, '') LIKE 'sub_%'
        OR COALESCE(p.university_number, '') LIKE 'SUBADMIN_%'
        OR COALESCE(p.email, '') LIKE '%@subadmin.%'
        OR LOWER(COALESCE(p.full_name, '')) LIKE '%a guard%'
      )
    );
END; $$;

GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;
