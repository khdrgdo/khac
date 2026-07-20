-- Product decision (confirmed by the user): course materials (files/links)
-- are managed by course staff only, not open student contribution. This
-- reverses the "any authenticated student can add" policy from
-- 20260724000000_allow_students_course_contributions.sql.
--
-- "Staff" for a given course = that course's teacher_id, whoever created it
-- (created_by — covers students who self-created a course and are still its
-- de-facto owner), or any admin. Course creation itself stays open to any
-- authenticated user (unchanged) so the existing "create a course" flow
-- keeps working — only adding files/links to a course you don't own is now
-- blocked.

-- ===== course_links =====
DROP POLICY IF EXISTS "course_links_insert_authenticated" ON public.course_links;

CREATE POLICY "course_links_insert_staff" ON public.course_links
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_links.course_id
        AND (c.teacher_id = auth.uid() OR c.created_by = auth.uid())
    )
  );

-- ===== storage.objects (course-files bucket) =====
-- Files are uploaded to path `${courseId}/${filename}`, so the course_id is
-- the first path segment.
DROP POLICY IF EXISTS "coursefiles_write_authenticated" ON storage.objects;

CREATE POLICY "coursefiles_write_staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-files'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND (c.teacher_id = auth.uid() OR c.created_by = auth.uid())
      )
    )
  );
