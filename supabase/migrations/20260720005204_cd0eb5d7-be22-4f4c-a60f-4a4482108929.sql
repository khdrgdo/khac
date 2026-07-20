
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;

CREATE POLICY profiles_select_self_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- Safe cross-user profile reader (no email/warning_count/suspended_until/banned/must_change_password)
CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text,
  major public.major_code,
  year smallint,
  bio text,
  points integer,
  university_number text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.major, p.year, p.bio, p.points, p.university_number
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
$$;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_public_profiles(_q text)
RETURNS TABLE(id uuid, full_name text, university_number text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.university_number, p.avatar_url
  FROM public.profiles p
  WHERE p.full_name ILIKE '%'||_q||'%' OR p.university_number ILIKE '%'||_q||'%'
  LIMIT 15;
$$;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text) TO authenticated;
