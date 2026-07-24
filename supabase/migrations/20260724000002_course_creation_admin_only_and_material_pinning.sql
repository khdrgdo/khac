-- 1. Restrict course CREATION to admin only. Teachers still manage
--    materials on courses they're assigned to (existing policies), but no
--    longer create new course entries themselves — matches the intended
--    workflow: admin creates the course and assigns a teacher to it.
DROP POLICY IF EXISTS "courses_insert_authenticated" ON public.courses;

CREATE POLICY "courses_insert_admin_only" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. "Important" flag + last-modified tracking on course materials, settable
--    by the course's teacher/creator/admin, used to pin + sort materials.
ALTER TABLE public.course_links
  ADD COLUMN IF NOT EXISTS is_important boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_course_links_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_course_links_updated_at ON public.course_links;
CREATE TRIGGER trg_touch_course_links_updated_at
BEFORE UPDATE ON public.course_links
FOR EACH ROW EXECUTE FUNCTION public.touch_course_links_updated_at();

-- Only the course's staff (teacher/creator/admin) may toggle is_important —
-- already covered by the existing course_links_update_own_or_staff USING/
-- WITH CHECK clauses (auth.uid() = created_by OR course teacher/creator OR
-- admin), no new policy needed since UPDATE is already scoped correctly.
