-- Corrective Migration: Fix has_role parameter order and clean university_number strings

-- 1. Fix name_change_requests policies
DROP POLICY IF EXISTS "Admins can view all name change requests" ON name_change_requests;
DROP POLICY IF EXISTS "Admins can update name change requests" ON name_change_requests;

CREATE POLICY "Admins can view all name change requests"
ON name_change_requests FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'sub_admin'::public.app_role));

CREATE POLICY "Admins can update name change requests"
ON name_change_requests FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'sub_admin'::public.app_role));

-- 2. Fix pinned_cards policies
DROP POLICY IF EXISTS "Admins can insert pinned cards" ON pinned_cards;
DROP POLICY IF EXISTS "Admins can update pinned cards" ON pinned_cards;

CREATE POLICY "Admins can insert pinned cards"
ON pinned_cards FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'sub_admin'::public.app_role));

CREATE POLICY "Admins can update pinned cards"
ON pinned_cards FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'sub_admin'::public.app_role));

-- 3. Fix RPC functions with correct has_role signature
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
    AND (
      r.user_id IS NULL 
      OR p.id = auth.uid() 
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
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
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
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
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  ORDER BY p.points DESC
  LIMIT 50;
END; $$;

-- 4. Clean up any corrupted university_number values that were prepended with HIDDEN_
UPDATE public.profiles
SET 
  hide_university_number = true,
  university_number = REPLACE(university_number, 'HIDDEN_', '')
WHERE university_number LIKE 'HIDDEN_%';
