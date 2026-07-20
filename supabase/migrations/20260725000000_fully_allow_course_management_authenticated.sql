-- Drop all existing restrictive policies for courses
DROP POLICY IF EXISTS "courses_select_all" ON public.courses;
DROP POLICY IF EXISTS "courses_insert_teacher_admin" ON public.courses;
DROP POLICY IF EXISTS "courses_insert_authenticated" ON public.courses;
DROP POLICY IF EXISTS "courses_update_own_or_admin" ON public.courses;
DROP POLICY IF EXISTS "courses_delete_admin" ON public.courses;

-- Create fully permissive policies for courses for any authenticated user
CREATE POLICY "courses_all_authenticated" ON public.courses
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Drop all existing restrictive policies for course_links
DROP POLICY IF EXISTS "course_links_select_all" ON public.course_links;
DROP POLICY IF EXISTS "course_links_insert" ON public.course_links;
DROP POLICY IF EXISTS "course_links_insert_authenticated" ON public.course_links;
DROP POLICY IF EXISTS "course_links_update" ON public.course_links;
DROP POLICY IF EXISTS "course_links_delete" ON public.course_links;

-- Create fully permissive policies for course_links for any authenticated user
CREATE POLICY "course_links_all_authenticated" ON public.course_links
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Drop storage policies for course-files
DROP POLICY IF EXISTS "coursefiles_read" ON storage.objects;
DROP POLICY IF EXISTS "coursefiles_write" ON storage.objects;
DROP POLICY IF EXISTS "coursefiles_delete" ON storage.objects;
DROP POLICY IF EXISTS "coursefiles_write_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "coursefiles_delete_authenticated" ON storage.objects;

-- Create fully permissive policies for course-files storage bucket
CREATE POLICY "coursefiles_read_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'course-files');

CREATE POLICY "coursefiles_write_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-files');

CREATE POLICY "coursefiles_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'course-files')
  WITH CHECK (bucket_id = 'course-files');

CREATE POLICY "coursefiles_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'course-files');
