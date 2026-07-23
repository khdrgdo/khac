-- 1. Alter app_role enum to add 'sub_admin'
-- Workaround to run ALTER TYPE inside a transaction block:
COMMIT;
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sub_admin';
BEGIN;

-- 2. Create subadmin_permissions table
CREATE TABLE IF NOT EXISTS public.subadmin_permissions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    can_warn BOOLEAN DEFAULT TRUE NOT NULL,
    can_suspend BOOLEAN DEFAULT TRUE NOT NULL,
    can_courses BOOLEAN DEFAULT TRUE NOT NULL,
    can_reports BOOLEAN DEFAULT TRUE NOT NULL,
    can_words BOOLEAN DEFAULT TRUE NOT NULL,
    can_teachers BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS for subadmin_permissions
ALTER TABLE public.subadmin_permissions ENABLE ROW LEVEL SECURITY;

-- Helper to check if a user is the main admin
CREATE OR REPLACE FUNCTION public.is_main_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_univ TEXT;
  v_email TEXT;
BEGIN
  SELECT university_number, email INTO v_univ, v_email FROM public.profiles WHERE id = _user_id;
  RETURN v_univ = '2011099840' OR LOWER(v_email) = 'khdrmamon@gmail.com';
END; $$;

-- Helper to check sub-admin specific permissions
CREATE OR REPLACE FUNCTION public.has_subadmin_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_has_perm BOOLEAN;
BEGIN
  -- Main admin always has all permissions
  IF public.is_main_admin(_user_id) THEN
    RETURN TRUE;
  END IF;

  -- Must possess sub_admin role
  IF NOT public.has_role(_user_id, 'sub_admin') THEN
    RETURN FALSE;
  END IF;

  -- Fetch permissions from table
  CASE _permission
    WHEN 'can_warn' THEN
      SELECT can_warn INTO v_has_perm FROM public.subadmin_permissions WHERE user_id = _user_id;
    WHEN 'can_suspend' THEN
      SELECT can_suspend INTO v_has_perm FROM public.subadmin_permissions WHERE user_id = _user_id;
    WHEN 'can_courses' THEN
      SELECT can_courses INTO v_has_perm FROM public.subadmin_permissions WHERE user_id = _user_id;
    WHEN 'can_reports' THEN
      SELECT can_reports INTO v_has_perm FROM public.subadmin_permissions WHERE user_id = _user_id;
    WHEN 'can_words' THEN
      SELECT can_words INTO v_has_perm FROM public.subadmin_permissions WHERE user_id = _user_id;
    WHEN 'can_teachers' THEN
      SELECT can_teachers INTO v_has_perm FROM public.subadmin_permissions WHERE user_id = _user_id;
    ELSE
      v_has_perm := FALSE;
  END CASE;

  RETURN COALESCE(v_has_perm, FALSE);
END; $$;

-- RLS policies for subadmin_permissions
DROP POLICY IF EXISTS "Allow users to read their own permissions or admins to read all" ON public.subadmin_permissions;
CREATE POLICY "Allow users to read their own permissions or admins to read all" 
ON public.subadmin_permissions 
FOR SELECT 
TO authenticated 
USING (
  auth.uid() = user_id OR 
  public.is_main_admin(auth.uid()) OR 
  public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Only main admins can write sub-admin permissions" ON public.subadmin_permissions;
CREATE POLICY "Only main admins can write sub-admin permissions" 
ON public.subadmin_permissions 
FOR ALL 
TO authenticated 
USING (
  public.is_main_admin(auth.uid())
)
WITH CHECK (
  public.is_main_admin(auth.uid())
);

-- 3. Migrate existing subadmins (marked by email, name pattern, or sub_ ID in user_roles and profiles)
DO $$
DECLARE
  r RECORD;
  v_bio JSONB;
  v_can_warn BOOLEAN;
  v_can_suspend BOOLEAN;
  v_can_courses BOOLEAN;
  v_can_reports BOOLEAN;
  v_can_words BOOLEAN;
  v_can_teachers BOOLEAN;
BEGIN
  FOR r IN 
    SELECT p.id, p.bio 
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'admin' AND (
      p.university_number LIKE 'sub_%' OR 
      p.email LIKE '%@subadmin.edu' OR 
      LOWER(p.full_name) LIKE '%a guard%'
    )
  LOOP
    -- Assign real sub_admin role
    UPDATE public.user_roles SET role = 'sub_admin' WHERE user_id = r.id;

    -- Extract bio JSON permissions
    BEGIN
      IF r.bio IS NOT NULL AND r.bio <> '' AND r.bio LIKE '{%' THEN
        v_bio := r.bio::jsonb;
        v_can_warn := COALESCE((v_bio->>'can_warn')::BOOLEAN, TRUE);
        v_can_suspend := COALESCE((v_bio->>'can_suspend')::BOOLEAN, TRUE);
        v_can_courses := COALESCE((v_bio->>'can_courses')::BOOLEAN, TRUE);
        v_can_reports := COALESCE((v_bio->>'can_reports')::BOOLEAN, TRUE);
        v_can_words := COALESCE((v_bio->>'can_words')::BOOLEAN, TRUE);
        v_can_teachers := COALESCE((v_bio->>'can_teachers')::BOOLEAN, TRUE);
      ELSE
        v_can_warn := TRUE;
        v_can_suspend := TRUE;
        v_can_courses := TRUE;
        v_can_reports := TRUE;
        v_can_words := TRUE;
        v_can_teachers := TRUE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_can_warn := TRUE;
      v_can_suspend := TRUE;
      v_can_courses := TRUE;
      v_can_reports := TRUE;
      v_can_words := TRUE;
      v_can_teachers := TRUE;
    END;

    -- Insert permissions
    INSERT INTO public.subadmin_permissions (
      user_id, can_warn, can_suspend, can_courses, can_reports, can_words, can_teachers
    ) VALUES (
      r.id, v_can_warn, v_can_suspend, v_can_courses, v_can_reports, v_can_words, v_can_teachers
    ) ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END; $$;

-- 4. Re-secure Admin functions to respect sub_admin permissions and is_main_admin helper

CREATE OR REPLACE FUNCTION public.admin_warn(_user UUID, _reason TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT;
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR public.has_subadmin_permission(auth.uid(), 'can_warn')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  INSERT INTO public.user_warnings (user_id, reason, issued_by) VALUES (_user, _reason, auth.uid());
  UPDATE public.profiles SET warning_count = warning_count + 1 WHERE id = _user RETURNING warning_count INTO v_count;
  
  IF v_count >= 3 THEN
    UPDATE public.profiles SET suspended_until = now() + interval '7 days' WHERE id = _user;
  END IF;
  
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'warn', jsonb_build_object('reason', _reason, 'count', v_count));
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_suspend(_user UUID, _days INT, _reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR public.has_subadmin_permission(auth.uid(), 'can_suspend')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  UPDATE public.profiles SET suspended_until = now() + (_days || ' days')::interval WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'suspend', jsonb_build_object('days', _days, 'reason', _reason));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_ban(_user UUID, _reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR public.has_subadmin_permission(auth.uid(), 'can_suspend')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  UPDATE public.profiles SET banned = true WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'ban', jsonb_build_object('reason', _reason));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_unban(_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR public.has_subadmin_permission(auth.uid(), 'can_suspend')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  UPDATE public.profiles SET banned = false, suspended_until = NULL, warning_count = 0 WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'unban', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_main_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'delete_user', '{}'::jsonb);
  DELETE FROM auth.users WHERE id = _user;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_year(_user UUID, _year SMALLINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR public.has_role(auth.uid(), 'sub_admin') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  UPDATE public.profiles SET year = _year WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'set_year', jsonb_build_object('year', _year));
END; $$;

-- 5. Secure general role changes and create a secure function for setting teacher roles

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user UUID, _role public.app_role)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only main admin can call general set role (sub-admins cannot elevate roles or change roles generally)
  IF NOT public.is_main_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  IF _user = auth.uid() THEN 
    RAISE EXCEPTION 'cannot change your own role via this function'; 
  END IF;

  -- replace any existing role rows for this user with the single new role
  DELETE FROM public.user_roles WHERE user_id = _user;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user, _role);

  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'set_role', jsonb_build_object('role', _role));
END; $$;

-- Secure helper function specifically for assigning the teacher role, callable by sub-admins with can_teachers permission
CREATE OR REPLACE FUNCTION public.admin_set_teacher_role(_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Check if caller is main admin OR sub-admin with can_teachers permission
  IF NOT (public.is_main_admin(auth.uid()) OR public.has_subadmin_permission(auth.uid(), 'can_teachers')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _user = auth.uid() THEN 
    RAISE EXCEPTION 'cannot change your own role via this function'; 
  END IF;

  -- Replace existing role with 'teacher'
  DELETE FROM public.user_roles WHERE user_id = _user;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user, 'teacher');

  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'set_role', jsonb_build_object('role', 'teacher'));
END; $$;

-- Ensure execute grants on new functions
GRANT EXECUTE ON FUNCTION public.is_main_admin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_subadmin_permission(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_teacher_role(UUID) TO authenticated, service_role;
