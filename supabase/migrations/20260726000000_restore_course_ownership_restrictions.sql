-- SECURITY FIX: the previous migration (fully_allow_course_management_authenticated)
-- granted USING (true) / WITH CHECK (true) for ALL operations (select/insert/update/delete)
-- on courses, course_links, and the course-files storage bucket to any authenticated
-- user. This means any logged-in student could delete or modify ANY other user's
-- courses, links, or uploaded files — not just their own.
--
-- This migration keeps the original intent (any authenticated student can create
-- courses/links/files) but restores ownership-based restrictions on update/delete,
-- using the existing `created_by` column on courses/course_links, and the built-in
-- `owner` column on storage.objects.

-- ===== courses =====
DROP POLICY IF EXISTS "courses_all_authenticated" ON public.courses;

CREATE POLICY "courses_select_all" ON public.courses
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "courses_insert_authenticated" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "courses_update_own_or_staff" ON public.courses
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'teacher')
  )
  WITH CHECK (
    auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'teacher')
  );

CREATE POLICY "courses_delete_own_or_staff" ON public.courses
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'teacher')
  );

-- ===== course_links =====
DROP POLICY IF EXISTS "course_links_all_authenticated" ON public.course_links;

CREATE POLICY "course_links_select_all" ON public.course_links
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "course_links_insert_authenticated" ON public.course_links
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "course_links_update_own_or_staff" ON public.course_links
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'teacher')
  )
  WITH CHECK (
    auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'teacher')
  );

CREATE POLICY "course_links_delete_own_or_staff" ON public.course_links
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'teacher')
  );

-- ===== storage.objects (course-files bucket) =====
DROP POLICY IF EXISTS "coursefiles_read_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "coursefiles_write_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "coursefiles_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "coursefiles_delete_authenticated" ON storage.objects;

CREATE POLICY "coursefiles_read_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'course-files');

CREATE POLICY "coursefiles_write_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-files');

CREATE POLICY "coursefiles_update_own_or_staff" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'course-files'
    AND (
      auth.uid() = owner
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'teacher')
    )
  )
  WITH CHECK (bucket_id = 'course-files');

CREATE POLICY "coursefiles_delete_own_or_staff" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-files'
    AND (
      auth.uid() = owner
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'teacher')
    )
  );
