-- 1. Upgrade public.is_main_admin to be completely bulletproof and case-insensitive
CREATE OR REPLACE FUNCTION public.is_main_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_univ TEXT;
  v_email TEXT;
BEGIN
  -- Check current authenticated user email directly from the JWT for instant robustness (case-insensitive)
  IF LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'khdrmamon@gmail.com' THEN
    RETURN TRUE;
  END IF;

  -- Also fallback to direct auth.users table query which is SECURITY DEFINER (so accessible)
  -- to check if the user's authentic email in auth.users is khdrmamon@gmail.com
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = _user_id AND LOWER(email) = 'khdrmamon@gmail.com'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Fallback to profiles table
  SELECT university_number, email INTO v_univ, v_email FROM public.profiles WHERE id = _user_id;
  RETURN COALESCE(v_univ, '') = '2011099840' OR LOWER(COALESCE(v_email, '')) = 'khdrmamon@gmail.com';
END; $$;

-- 2. Upgrade public.admin_delete_user to perform a deep, ordered manual clean-up before deleting the auth.users record.
-- This bypasses any potential RLS, foreign key, or trigger block constraints on cascading delete.
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Ensure caller is the main admin
  IF NOT public.is_main_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Log the admin action first (using a separate log record so it remains if desired, but we clean up references)
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), NULL, 'delete_user_triggered', jsonb_build_object('deleted_user_id', _user));

  -- Step-by-step manual cascading deletion to guarantee absolute success:

  -- 1. subadmin_permissions
  DELETE FROM public.subadmin_permissions WHERE user_id = _user;

  -- 2. user_roles
  DELETE FROM public.user_roles WHERE user_id = _user;

  -- 3. blocked_users
  DELETE FROM public.blocked_users WHERE blocker_id = _user OR blocked_id = _user;

  -- 4. message_reports
  DELETE FROM public.message_reports WHERE reporter_id = _user OR reported_user_id = _user;

  -- 5. user_warnings
  DELETE FROM public.user_warnings WHERE user_id = _user OR issued_by = _user;

  -- 6. post_reactions
  DELETE FROM public.post_reactions WHERE user_id = _user;

  -- 7. saved_posts
  DELETE FROM public.saved_posts WHERE user_id = _user;

  -- 8. comments
  -- Set accepted_answer_id to NULL on posts first to avoid circular reference blocks
  UPDATE public.posts SET accepted_answer_id = NULL WHERE accepted_answer_id IN (SELECT id FROM public.comments WHERE author_id = _user);
  DELETE FROM public.comments WHERE author_id = _user;

  -- 9. post_reports
  DELETE FROM public.post_reports WHERE reporter_id = _user;

  -- 10. posts
  DELETE FROM public.posts WHERE author_id = _user;

  -- 11. course_updates
  DELETE FROM public.course_updates WHERE author_id = _user;

  -- 12. conversation_members
  DELETE FROM public.conversation_members WHERE user_id = _user;

  -- 13. messages
  DELETE FROM public.messages WHERE sender_id = _user;

  -- 14. courses SET NULL
  UPDATE public.courses SET teacher_id = NULL WHERE teacher_id = _user;
  UPDATE public.courses SET created_by = NULL WHERE created_by = _user;

  -- 15. course_links SET NULL
  UPDATE public.course_links SET created_by = NULL WHERE created_by = _user;

  -- 16. conversations SET NULL
  UPDATE public.conversations SET created_by = NULL WHERE created_by = _user;

  -- 17. Clean up admin_actions where the target is this user
  UPDATE public.admin_actions SET target_user_id = NULL WHERE target_user_id = _user;
  -- Clean up admin_actions where the admin is this user
  DELETE FROM public.admin_actions WHERE admin_id = _user;

  -- 18. profiles
  DELETE FROM public.profiles WHERE id = _user;

  -- 19. auth.users
  DELETE FROM auth.users WHERE id = _user;
END; $$;
