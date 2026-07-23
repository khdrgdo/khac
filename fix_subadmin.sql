-- 1. Create helper functions
CREATE OR REPLACE FUNCTION public.is_main_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_univ TEXT;
  v_email TEXT;
BEGIN
  SELECT university_number, email INTO v_univ, v_email FROM public.profiles WHERE id = _user_id;
  RETURN v_univ = '2011099840' OR LOWER(v_email) = 'khdrmamon@gmail.com';
END; $$;

CREATE OR REPLACE FUNCTION public.has_subadmin_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_has_perm BOOLEAN;
BEGIN
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

GRANT EXECUTE ON FUNCTION public.is_main_admin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_subadmin_permission(UUID, TEXT) TO authenticated, service_role;

-- 2. Update Policies for Profiles (Fixes the visibility issue)
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all_for_admins" ON public.profiles;

CREATE POLICY "profiles_select_all_for_admins" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND (role = 'admin' OR role = 'sub_admin')
  )
);

-- 3. Update Policies for User Roles
DROP POLICY IF EXISTS "user_roles_select_all" ON public.user_roles;
CREATE POLICY "user_roles_select_all" ON public.user_roles
FOR SELECT TO authenticated
USING (true);

-- 4. Ensure subadmin_permissions table exists
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
ALTER TABLE public.subadmin_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read their own permissions or admins to read all" ON public.subadmin_permissions;
CREATE POLICY "Allow users to read their own permissions or admins to read all" 
ON public.subadmin_permissions 
FOR SELECT TO authenticated 
USING (
  auth.uid() = user_id OR 
  public.is_main_admin(auth.uid()) OR 
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Only main admins can write sub-admin permissions" ON public.subadmin_permissions;
CREATE POLICY "Only main admins can write sub-admin permissions" 
ON public.subadmin_permissions 
FOR ALL TO authenticated 
USING (public.is_main_admin(auth.uid()))
WITH CHECK (public.is_main_admin(auth.uid()));

-- 5. Admin RPCs for banning, suspending, warning
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

CREATE OR REPLACE FUNCTION public.admin_set_year(_user UUID, _year SMALLINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'sub_admin'))) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  UPDATE public.profiles SET year = _year WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'set_year', jsonb_build_object('year', _year));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_teacher_role(_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR public.has_subadmin_permission(auth.uid(), 'can_teachers')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _user = auth.uid() THEN 
    RAISE EXCEPTION 'cannot change your own role via this function'; 
  END IF;
  
  DELETE FROM public.user_roles WHERE user_id = _user;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user, 'teacher');
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'set_role', jsonb_build_object('role', 'teacher'));
END; $$;
