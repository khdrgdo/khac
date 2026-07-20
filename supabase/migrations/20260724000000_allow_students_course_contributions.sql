-- Drop restrictive course and course_links policies
DROP POLICY IF EXISTS "courses_insert_teacher_admin" ON public.courses;
DROP POLICY IF EXISTS "course_links_insert" ON public.course_links;
DROP POLICY IF EXISTS "coursefiles_write" ON storage.objects;
DROP POLICY IF EXISTS "coursefiles_delete" ON storage.objects;

-- Create new policies allowing any authenticated student to insert courses, add links, and upload files
CREATE POLICY "courses_insert_authenticated" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "course_links_insert_authenticated" ON public.course_links
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "coursefiles_write_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-files');

CREATE POLICY "coursefiles_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'course-files' AND (auth.uid() = owner OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher')));
