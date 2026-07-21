-- FIX: an earlier migration (restore_course_ownership_restrictions) replaced
-- courses UPDATE/DELETE policies with a check on has_role(auth.uid(),'teacher')
-- — meaning ANY teacher account could edit or delete ANY course, not just the
-- one they're actually assigned to. The original policy (from the very first
-- schema migration) correctly checked auth.uid() = teacher_id specifically;
-- this restores that precise per-course check.

DROP POLICY IF EXISTS "courses_update_own_or_staff" ON public.courses;
DROP POLICY IF EXISTS "courses_delete_own_or_staff" ON public.courses;

CREATE POLICY "courses_update_own_or_staff" ON public.courses
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = teacher_id
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = created_by
    OR auth.uid() = teacher_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "courses_delete_own_or_staff" ON public.courses
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = teacher_id
    OR public.has_role(auth.uid(), 'admin')
  );

-- Same correction for course_links: teacher_id must refer to the specific
-- course's assigned teacher, not "is a teacher anywhere".
DROP POLICY IF EXISTS "course_links_update_own_or_staff" ON public.course_links;
DROP POLICY IF EXISTS "course_links_delete_own_or_staff" ON public.course_links;

CREATE POLICY "course_links_update_own_or_staff" ON public.course_links
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_links.course_id
        AND (c.teacher_id = auth.uid() OR c.created_by = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_links.course_id
        AND (c.teacher_id = auth.uid() OR c.created_by = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "course_links_delete_own_or_staff" ON public.course_links
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_links.course_id
        AND (c.teacher_id = auth.uid() OR c.created_by = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );
