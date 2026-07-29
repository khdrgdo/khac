-- Allow sub_admins to also create courses (previously admin-only).
-- Sub-admins appear as "admin" in the frontend, but the DB policy
-- only checked has_role('admin'), which excludes 'sub_admin'.
DROP POLICY IF EXISTS "courses_insert_admin_only" ON public.courses;

CREATE POLICY "courses_insert_admin_or_subadmin" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'sub_admin')
  );
