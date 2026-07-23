-- 1) Allow sub-admins to SELECT profiles
DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;
CREATE POLICY profiles_select_self_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id OR 
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.is_main_admin(auth.uid()) OR 
    public.has_role(auth.uid(), 'sub_admin'::public.app_role)
  );

-- 2) Allow sub-admins to SELECT user_roles
DROP POLICY IF EXISTS user_roles_select_own_or_admin ON public.user_roles;
CREATE POLICY user_roles_select_own_or_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR 
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.is_main_admin(auth.uid()) OR 
    public.has_role(auth.uid(), 'sub_admin'::public.app_role)
  );

-- 3) Allow sub-admins to SELECT user_warnings (to view user history during moderation)
DROP POLICY IF EXISTS uw_select ON public.user_warnings;
CREATE POLICY uw_select ON public.user_warnings
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR 
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.is_main_admin(auth.uid()) OR 
    public.has_role(auth.uid(), 'sub_admin'::public.app_role)
  );

-- 4) Allow sub-admins to SELECT, UPDATE, and DELETE post_reports (for moderation)
DROP POLICY IF EXISTS "user reads own reports" ON public.post_reports;
CREATE POLICY "user reads own reports" ON public.post_reports
  FOR SELECT TO authenticated
  USING (
    auth.uid() = reporter_id OR 
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.is_main_admin(auth.uid()) OR 
    public.has_role(auth.uid(), 'sub_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "admin updates reports" ON public.post_reports;
CREATE POLICY "admin updates reports" ON public.post_reports
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.is_main_admin(auth.uid()) OR 
    (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_reports'))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.is_main_admin(auth.uid()) OR 
    (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_reports'))
  );

DROP POLICY IF EXISTS "admin deletes reports" ON public.post_reports;
CREATE POLICY "admin deletes reports" ON public.post_reports
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.is_main_admin(auth.uid()) OR 
    (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_reports'))
  );

-- 5) Allow sub-admins to manage banned words if they have permission
DROP POLICY IF EXISTS "admin manage banned words" ON public.banned_words;
CREATE POLICY "admin manage banned words" ON public.banned_words
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.is_main_admin(auth.uid()) OR 
    (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_words'))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.is_main_admin(auth.uid()) OR 
    (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_words'))
  );

-- 6) Allow sub-admins to update and delete courses if they have permission
DROP POLICY IF EXISTS "courses_update_own_or_staff" ON public.courses;
CREATE POLICY "courses_update_own_or_staff" ON public.courses
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = teacher_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_main_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_courses'))
  )
  WITH CHECK (
    auth.uid() = created_by
    OR auth.uid() = teacher_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_main_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_courses'))
  );

DROP POLICY IF EXISTS "courses_delete_own_or_staff" ON public.courses;
CREATE POLICY "courses_delete_own_or_staff" ON public.courses
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = teacher_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_main_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_courses'))
  );

-- 7) Allow sub-admins to update and delete course links if they have permission
DROP POLICY IF EXISTS "course_links_update_own_or_staff" ON public.course_links;
CREATE POLICY "course_links_update_own_or_staff" ON public.course_links
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_links.course_id
        AND (c.teacher_id = auth.uid() OR c.created_by = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_main_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_courses'))
  )
  WITH CHECK (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_links.course_id
        AND (c.teacher_id = auth.uid() OR c.created_by = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_main_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_courses'))
  );

DROP POLICY IF EXISTS "course_links_delete_own_or_staff" ON public.course_links;
CREATE POLICY "course_links_delete_own_or_staff" ON public.course_links
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_links.course_id
        AND (c.teacher_id = auth.uid() OR c.created_by = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_main_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_courses'))
  );
