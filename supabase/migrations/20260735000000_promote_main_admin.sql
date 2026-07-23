-- 1) Promote khdrmamon@gmail.com to admin role in user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM public.profiles WHERE LOWER(email) = 'khdrmamon@gmail.com'
ON CONFLICT DO NOTHING;

-- 2) Update profiles SELECT policy to allow main admin
DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;
CREATE POLICY profiles_select_self_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin') OR public.is_main_admin(auth.uid()));

-- 3) Update profiles UPDATE policy to allow main admin
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin') OR public.is_main_admin(auth.uid()))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin') OR public.is_main_admin(auth.uid()));

-- 4) Update profiles DELETE policy to allow main admin
DROP POLICY IF EXISTS profiles_delete_admin ON public.profiles;
CREATE POLICY profiles_delete_admin ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_main_admin(auth.uid()));

-- 5) Update user_roles admin all policy to allow main admin
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
CREATE POLICY user_roles_admin_all ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_main_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_main_admin(auth.uid()));

-- 6) Recreate protect_privileged_profile_columns trigger function to also check is_main_admin
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_main_admin(auth.uid())) THEN
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

-- 7) Recreate admin_set_verified function to also check is_main_admin
CREATE OR REPLACE FUNCTION public.admin_set_verified(_user uuid, _verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_main_admin(auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.profiles SET verified = _verified WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
  VALUES (auth.uid(), _user, CASE WHEN _verified THEN 'verify' ELSE 'unverify' END, NULL);
END;
$$;
