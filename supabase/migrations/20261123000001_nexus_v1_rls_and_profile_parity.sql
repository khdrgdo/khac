-- NEXUS 1.0.0 — RLS, administration boundaries, profile changes and moderation
-- Requires 20261123000000_nexus_v1_auth_rpc_hardening.sql.

BEGIN;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS has_used_direct_name_change boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.name_change_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_name text NOT NULL,
    requested_name text NOT NULL,
    reason text NOT NULL,
    contact_info text NOT NULL,
    university_number text,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS name_change_requests_one_pending_per_user
ON public.name_change_requests(user_id)
WHERE status = 'pending';

ALTER TABLE public.name_change_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.name_change_requests FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.name_change_requests TO authenticated;

DROP POLICY IF EXISTS name_change_requests_select_own ON public.name_change_requests;
DROP POLICY IF EXISTS name_change_requests_insert_own ON public.name_change_requests;
DROP POLICY IF EXISTS name_change_requests_admin_all ON public.name_change_requests;

CREATE POLICY name_change_requests_select_own_or_manager
ON public.name_change_requests
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_users')
);

CREATE POLICY name_change_requests_insert_own_pending
ON public.name_change_requests
FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND processed_at IS NULL
);

CREATE POLICY name_change_requests_delete_own_pending
ON public.name_change_requests
FOR DELETE TO authenticated
USING (
    (user_id = auth.uid() AND status = 'pending')
    OR public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Profile identity changes are server-controlled. Direct profile updates cannot
-- reset the one-time name-change flag or alter the name outside the RPCs below.
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.has_role(auth.uid(), 'admin'::public.app_role)
       OR current_setting('app.trusted_profile_update', true) = 'on'
       OR current_setting('app.allow_password_flag_change', true) = 'on'
       OR current_setting('app.allow_name_change', true) = 'on' THEN
        RETURN NEW;
    END IF;

    NEW.points := OLD.points;
    NEW.banned := OLD.banned;
    NEW.suspended_until := OLD.suspended_until;
    NEW.warning_count := OLD.warning_count;
    NEW.verified := OLD.verified;
    NEW.must_change_password := OLD.must_change_password;
    NEW.has_used_direct_name_change := OLD.has_used_direct_name_change;
    NEW.full_name := OLD.full_name;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.direct_name_change(_new_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_used boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF length(trim(_new_name)) < 2 OR length(trim(_new_name)) > 70 THEN
        RAISE EXCEPTION 'Name must contain between 2 and 70 characters';
    END IF;

    SELECT has_used_direct_name_change
    INTO v_used
    FROM public.profiles
    WHERE id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    IF v_used THEN
        RAISE EXCEPTION 'The one-time direct name change has already been used';
    END IF;

    PERFORM set_config('app.allow_name_change', 'on', true);

    UPDATE public.profiles
    SET full_name = trim(_new_name),
        has_used_direct_name_change = true
    WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_process_name_change_request(
    _request_id uuid,
    _approve boolean,
    _admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.name_change_requests%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL OR NOT (
        public.is_main_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_subadmin_permission(auth.uid(), 'can_users')
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT *
    INTO v_request
    FROM public.name_change_requests
    WHERE id = _request_id
      AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending request not found';
    END IF;

    IF _approve THEN
        PERFORM set_config('app.allow_name_change', 'on', true);

        UPDATE public.profiles
        SET full_name = v_request.requested_name,
            has_used_direct_name_change = true
        WHERE id = v_request.user_id;

        UPDATE public.name_change_requests
        SET status = 'approved',
            admin_note = _admin_note,
            processed_at = now()
        WHERE id = _request_id;
    ELSE
        UPDATE public.name_change_requests
        SET status = 'rejected',
            admin_note = _admin_note,
            processed_at = now()
        WHERE id = _request_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.direct_name_change(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_process_name_change_request(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direct_name_change(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_process_name_change_request(uuid, boolean, text) TO authenticated;

-- A profile or role directory is visible to its owner and explicitly authorized
-- user managers only. Sub-admin status alone grants no directory access.
DROP POLICY IF EXISTS profiles_select_all_for_admins ON public.profiles;
DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;

CREATE POLICY profiles_select_self_admin_or_user_manager
ON public.profiles
FOR SELECT TO authenticated
USING (
    id = auth.uid()
    OR public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_users')
);

-- Role assignments are read-only from the client. Mutations must go through
-- the role-checked SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS user_roles_select_own_or_admin ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;

CREATE POLICY user_roles_select_self_or_user_manager
ON public.user_roles
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_users')
);

CREATE POLICY user_roles_no_direct_writes
ON public.user_roles
FOR ALL TO authenticated
USING (false)
WITH CHECK (false);

-- Only the main administrator can mutate sub-admin permission records.
DROP POLICY IF EXISTS subadmin_permissions_admin_all ON public.subadmin_permissions;
CREATE POLICY subadmin_permissions_main_admin_manage
ON public.subadmin_permissions
FOR ALL TO authenticated
USING (public.is_main_admin(auth.uid()))
WITH CHECK (public.is_main_admin(auth.uid()));

-- Warnings are read by the subject and by administrators / authorized managers.
DROP POLICY IF EXISTS uw_insert ON public.user_warnings;
DROP POLICY IF EXISTS uw_select ON public.user_warnings;
DROP POLICY IF EXISTS user_warnings_admin_all ON public.user_warnings;
DROP POLICY IF EXISTS user_warnings_select_own_or_admin ON public.user_warnings;

CREATE POLICY user_warnings_select_own_or_manager
ON public.user_warnings
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_users')
    OR public.has_subadmin_permission(auth.uid(), 'can_warn')
    OR public.has_subadmin_permission(auth.uid(), 'can_suspend')
);

-- Report creation remains available to authenticated users; review actions are
-- available only to admins and sub-admins with can_reports.
DROP POLICY IF EXISTS "admin deletes reports" ON public.post_reports;
DROP POLICY IF EXISTS "admin updates reports" ON public.post_reports;
DROP POLICY IF EXISTS "user creates own reports" ON public.post_reports;
DROP POLICY IF EXISTS "user reads own reports" ON public.post_reports;
DROP POLICY IF EXISTS post_reports_admin_all ON public.post_reports;
DROP POLICY IF EXISTS post_reports_select_own_or_admin ON public.post_reports;

CREATE POLICY post_reports_insert_own
ON public.post_reports
FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

CREATE POLICY post_reports_select_own_or_manager
ON public.post_reports
FOR SELECT TO authenticated
USING (
    reporter_id = auth.uid()
    OR public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_reports')
);

CREATE POLICY post_reports_update_manager
ON public.post_reports
FOR UPDATE TO authenticated
USING (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_reports')
)
WITH CHECK (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_reports')
);

CREATE POLICY post_reports_delete_manager
ON public.post_reports
FOR DELETE TO authenticated
USING (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_reports')
);

DROP POLICY IF EXISTS "admin deletes message reports" ON public.message_reports;
DROP POLICY IF EXISTS "admin updates message reports" ON public.message_reports;
DROP POLICY IF EXISTS "user creates own message reports" ON public.message_reports;
DROP POLICY IF EXISTS "user reads own message reports" ON public.message_reports;
DROP POLICY IF EXISTS message_reports_admin_all ON public.message_reports;
DROP POLICY IF EXISTS message_reports_select_own_or_admin ON public.message_reports;

CREATE POLICY message_reports_insert_own
ON public.message_reports
FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

CREATE POLICY message_reports_select_own_or_manager
ON public.message_reports
FOR SELECT TO authenticated
USING (
    reporter_id = auth.uid()
    OR public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_reports')
);

CREATE POLICY message_reports_update_manager
ON public.message_reports
FOR UPDATE TO authenticated
USING (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_reports')
)
WITH CHECK (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_reports')
);

CREATE POLICY message_reports_delete_manager
ON public.message_reports
FOR DELETE TO authenticated
USING (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_reports')
);

DROP POLICY IF EXISTS anon_authors_select_admin_or_self ON public.anonymous_authors;
CREATE POLICY anonymous_authors_select_self_or_reports_manager
ON public.anonymous_authors
FOR SELECT TO authenticated
USING (
    author_id = auth.uid()
    OR public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_reports')
);

-- Banned words are readable by signed-in clients for immediate feedback, but
-- only the main admin or can_words sub-admins can mutate the dictionary.
DROP POLICY IF EXISTS "admin manage banned words" ON public.banned_words;
DROP POLICY IF EXISTS "read banned words" ON public.banned_words;

CREATE POLICY banned_words_read_authenticated
ON public.banned_words
FOR SELECT TO authenticated
USING (true);

CREATE POLICY banned_words_manage_authorized
ON public.banned_words
FOR ALL TO authenticated
USING (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_words')
)
WITH CHECK (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_words')
);

-- Pinned-card configuration is admin-only; ordinary participation policies stay.
DROP POLICY IF EXISTS "Admins can insert pinned cards" ON public.pinned_cards;
DROP POLICY IF EXISTS "Admins can update pinned cards" ON public.pinned_cards;
DROP POLICY IF EXISTS "Allow admins to update pinned_cards" ON public.pinned_cards;
DROP POLICY IF EXISTS pinned_cards_admin_insert ON public.pinned_cards;
DROP POLICY IF EXISTS pinned_cards_admin_update ON public.pinned_cards;

CREATE POLICY pinned_cards_admin_insert_v1
ON public.pinned_cards
FOR INSERT TO authenticated
WITH CHECK (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY pinned_cards_admin_update_v1
ON public.pinned_cards
FOR UPDATE TO authenticated
USING (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY pinned_cards_admin_delete_v1
ON public.pinned_cards
FOR DELETE TO authenticated
USING (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Course ownership is explicit: assigned teacher, creator, main/admin, or a
-- sub-admin with can_courses. Broad "any sub-admin" policies are removed.
DROP POLICY IF EXISTS courses_insert_admin ON public.courses;
DROP POLICY IF EXISTS courses_insert_admin_or_subadmin ON public.courses;
DROP POLICY IF EXISTS courses_insert_teacher_admin ON public.courses;
DROP POLICY IF EXISTS courses_update_own_or_staff ON public.courses;
DROP POLICY IF EXISTS courses_delete_own_or_staff ON public.courses;

CREATE POLICY courses_insert_authorized
ON public.courses
FOR INSERT TO authenticated
WITH CHECK (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_courses')
    OR (
        public.has_role(auth.uid(), 'teacher'::public.app_role)
        AND teacher_id = auth.uid()
        AND created_by = auth.uid()
    )
);

CREATE POLICY courses_update_authorized
ON public.courses
FOR UPDATE TO authenticated
USING (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_courses')
    OR teacher_id = auth.uid()
    OR created_by = auth.uid()
)
WITH CHECK (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_courses')
    OR teacher_id = auth.uid()
    OR created_by = auth.uid()
);

CREATE POLICY courses_delete_authorized
ON public.courses
FOR DELETE TO authenticated
USING (
    public.is_main_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_subadmin_permission(auth.uid(), 'can_courses')
    OR teacher_id = auth.uid()
    OR created_by = auth.uid()
);

DROP POLICY IF EXISTS course_links_insert ON public.course_links;
DROP POLICY IF EXISTS course_links_insert_staff ON public.course_links;
DROP POLICY IF EXISTS course_links_update_own_or_staff ON public.course_links;
DROP POLICY IF EXISTS course_links_delete_own_or_staff ON public.course_links;

CREATE POLICY course_links_insert_authorized
ON public.course_links
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = course_id
          AND (
              public.is_main_admin(auth.uid())
              OR public.has_role(auth.uid(), 'admin'::public.app_role)
              OR public.has_subadmin_permission(auth.uid(), 'can_courses')
              OR c.teacher_id = auth.uid()
              OR c.created_by = auth.uid()
          )
    )
);

CREATE POLICY course_links_update_authorized
ON public.course_links
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = course_id
          AND (
              public.is_main_admin(auth.uid())
              OR public.has_role(auth.uid(), 'admin'::public.app_role)
              OR public.has_subadmin_permission(auth.uid(), 'can_courses')
              OR c.teacher_id = auth.uid()
              OR c.created_by = auth.uid()
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = course_id
          AND (
              public.is_main_admin(auth.uid())
              OR public.has_role(auth.uid(), 'admin'::public.app_role)
              OR public.has_subadmin_permission(auth.uid(), 'can_courses')
              OR c.teacher_id = auth.uid()
              OR c.created_by = auth.uid()
          )
    )
);

CREATE POLICY course_links_delete_authorized
ON public.course_links
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = course_id
          AND (
              public.is_main_admin(auth.uid())
              OR public.has_role(auth.uid(), 'admin'::public.app_role)
              OR public.has_subadmin_permission(auth.uid(), 'can_courses')
              OR c.teacher_id = auth.uid()
              OR c.created_by = auth.uid()
          )
    )
);

-- Direct post/comment inserts are blocked. The validated SECURITY DEFINER RPCs
-- create_post_as and create_comment_as remain the only creation path.
DROP POLICY IF EXISTS posts_insert_self ON public.posts;
CREATE POLICY posts_insert_via_rpc_only
ON public.posts
FOR INSERT TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS comments_insert_self ON public.comments;
CREATE POLICY comments_insert_via_rpc_only
ON public.comments
FOR INSERT TO authenticated
WITH CHECK (false);

REVOKE ALL ON FUNCTION public.create_post_as(public.post_type, text, text[], boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_comment_as(uuid, text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_post_as(public.post_type, text, text[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_comment_as(uuid, text, uuid, boolean) TO authenticated;

-- Direct notification inserts are removed. Activity creation and admin
-- broadcasts use the validated RPCs in the next migration.
DROP POLICY IF EXISTS notifications_admin_insert ON public.notifications;
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
DROP POLICY IF EXISTS notifications_admin_delete ON public.notifications;

CREATE POLICY notifications_select_sent_by_admin
ON public.notifications
FOR SELECT TO authenticated
USING (
    actor_id = auth.uid()
    AND (
        public.is_main_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
);

CREATE POLICY notifications_update_sent_by_admin
ON public.notifications
FOR UPDATE TO authenticated
USING (
    actor_id = auth.uid()
    AND (
        public.is_main_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
)
WITH CHECK (
    actor_id = auth.uid()
    AND (
        public.is_main_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
);

CREATE POLICY notifications_delete_sent_by_admin
ON public.notifications
FOR DELETE TO authenticated
USING (
    actor_id = auth.uid()
    AND (
        public.is_main_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
);

-- Suspension and bans are enforced at the database boundary, including RPC
-- inserts, direct message writes and reaction upserts.
CREATE OR REPLACE FUNCTION public.enforce_active_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_banned boolean;
    v_suspended_until timestamptz;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT p.banned, p.suspended_until
    INTO v_banned, v_suspended_until
    FROM public.profiles p
    WHERE p.id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    IF COALESCE(v_banned, false) THEN
        RAISE EXCEPTION 'This account is banned';
    END IF;

    IF v_suspended_until IS NOT NULL AND v_suspended_until > now() THEN
        RAISE EXCEPTION 'This account is temporarily suspended';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_enforce_active_account_posts ON public.posts;
CREATE TRIGGER zz_enforce_active_account_posts
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_active_account();

DROP TRIGGER IF EXISTS zz_enforce_active_account_comments ON public.comments;
CREATE TRIGGER zz_enforce_active_account_comments
BEFORE INSERT OR UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_active_account();

DROP TRIGGER IF EXISTS zz_enforce_active_account_messages ON public.messages;
CREATE TRIGGER zz_enforce_active_account_messages
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_active_account();

DROP TRIGGER IF EXISTS zz_enforce_active_account_reactions ON public.post_reactions;
CREATE TRIGGER zz_enforce_active_account_reactions
BEFORE INSERT OR UPDATE ON public.post_reactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_active_account();

REVOKE ALL ON FUNCTION public.enforce_active_account() FROM PUBLIC, anon, authenticated;

COMMIT;
