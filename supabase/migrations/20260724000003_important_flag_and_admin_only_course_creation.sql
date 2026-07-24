-- 1) "Important" flag on course materials (links AND files both live in
-- course_links), settable by the course's teacher/creator/admin — reuses
-- the existing course_links_update_own_or_staff UPDATE policy, which
-- already allows those roles to update any column on a row they own/manage
-- (no new policy needed for this specific column).
ALTER TABLE public.course_links ADD COLUMN IF NOT EXISTS is_important boolean NOT NULL DEFAULT false;

-- 2) Restrict course *creation* to admins only. Previously any teacher
-- could create a course themselves (courses_insert_authenticated,
-- WITH CHECK (true)); the product decision now is that only an admin
-- creates a course record (and assigns a teacher to it) — teachers manage
-- materials on courses already assigned to them, they no longer create the
-- course entries themselves.
DROP POLICY IF EXISTS "courses_insert_authenticated" ON public.courses;
CREATE POLICY "courses_insert_admin" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
