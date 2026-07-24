-- Fix ON DELETE CASCADE failing due to RLS on child tables
-- When a user deletes their own post, they must have permission to delete all child rows.

CREATE POLICY "comments_delete_post_author" ON public.comments
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));

CREATE POLICY "reactions_delete_post_author" ON public.post_reactions
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_main_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_reports'))
  );

CREATE POLICY "saved_delete_post_author" ON public.saved_posts
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_main_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_reports'))
  );

DROP POLICY IF EXISTS "admin deletes reports" ON public.post_reports;
CREATE POLICY "admin deletes reports" ON public.post_reports
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_main_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_reports'))
  );

-- Also, fix posts_delete_own_or_admin to include is_main_admin and sub_admin logic
DROP POLICY IF EXISTS "posts_delete_own_or_admin" ON public.posts;
CREATE POLICY "posts_delete_own_or_admin" ON public.posts
  FOR DELETE TO authenticated
  USING (
    auth.uid() = author_id 
    OR public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_main_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_reports'))
  );

-- And for comments
DROP POLICY IF EXISTS "comments_delete_own_or_admin" ON public.comments;
CREATE POLICY "comments_delete_own_or_admin" ON public.comments
  FOR DELETE TO authenticated
  USING (
    auth.uid() = author_id 
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_main_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'sub_admin'::public.app_role) AND public.has_subadmin_permission(auth.uid(), 'can_reports'))
  );
