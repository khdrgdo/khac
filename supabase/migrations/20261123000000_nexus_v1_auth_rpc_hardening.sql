-- NEXUS 1.0.0 — identity, account lifecycle and RPC authorization
-- This migration is authored for review. Do not apply to production until the
-- live schema is backed up and the deployment checklist has been approved.

BEGIN;

-- New sub-admins must receive explicit permissions. Existing rows are preserved.
ALTER TABLE public.subadmin_permissions
    ADD COLUMN IF NOT EXISTS can_users boolean NOT NULL DEFAULT false;

ALTER TABLE public.subadmin_permissions
    ALTER COLUMN can_warn SET DEFAULT false,
    ALTER COLUMN can_suspend SET DEFAULT false,
    ALTER COLUMN can_courses SET DEFAULT false,
    ALTER COLUMN can_reports SET DEFAULT false,
    ALTER COLUMN can_words SET DEFAULT false,
    ALTER COLUMN can_teachers SET DEFAULT false;

-- Bootstrap the existing owner identity once, using the currently deployed
-- is_main_admin predicate. Thereafter the trust anchor is an immutable auth UUID.
CREATE TABLE IF NOT EXISTS public.system_admins (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.system_admins FROM PUBLIC, anon, authenticated;

INSERT INTO public.system_admins(user_id)
SELECT p.id
FROM public.profiles p
WHERE public.is_main_admin(p.id)
ON CONFLICT (user_id) DO NOTHING;

DO $$
DECLARE
    v_admin_count integer;
BEGIN
    SELECT count(*) INTO v_admin_count FROM public.system_admins;
    IF v_admin_count <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one existing main admin while bootstrapping system_admins; found %',
            v_admin_count;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_main_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL
       AND _user_id = auth.uid()
       AND EXISTS (
           SELECT 1
           FROM public.system_admins sa
           WHERE sa.user_id = _user_id
       );
$$;

REVOKE ALL ON FUNCTION public.is_main_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_main_admin(uuid) TO authenticated;

-- Role checks are self-scoped. The main admin may inspect another user's role
-- for administration, but an ordinary authenticated user cannot enumerate roles.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL
       AND (_user_id = auth.uid() OR public.is_main_admin(auth.uid()))
       AND EXISTS (
           SELECT 1
           FROM public.user_roles ur
           WHERE ur.user_id = _user_id
             AND ur.role = _role
       );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_subadmin_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_allowed boolean := false;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    IF _user_id IS DISTINCT FROM auth.uid()
       AND NOT public.is_main_admin(auth.uid()) THEN
        RETURN false;
    END IF;

    IF public.is_main_admin(_user_id) THEN
        RETURN true;
    END IF;

    IF NOT public.has_role(_user_id, 'sub_admin'::public.app_role) THEN
        RETURN false;
    END IF;

    SELECT CASE _permission
        WHEN 'can_users' THEN COALESCE(sp.can_users, false)
        WHEN 'can_courses' THEN COALESCE(sp.can_courses, false)
        WHEN 'can_reports' THEN COALESCE(sp.can_reports, false)
        WHEN 'can_teachers' THEN COALESCE(sp.can_teachers, false)
        WHEN 'can_words' THEN COALESCE(sp.can_words, false)
        WHEN 'can_warn' THEN COALESCE(sp.can_warn, false)
        WHEN 'can_suspend' THEN COALESCE(sp.can_suspend, false)
        ELSE false
    END
    INTO v_allowed
    FROM public.subadmin_permissions sp
    WHERE sp.user_id = _user_id;

    RETURN COALESCE(v_allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.has_subadmin_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_subadmin_permission(uuid, text) TO authenticated;

-- Anonymous ownership may only be checked by the account that owns the content.
CREATE OR REPLACE FUNCTION public.is_anonymous_owner(_type text, _id uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL
       AND _user = auth.uid()
       AND EXISTS (
           SELECT 1
           FROM public.anonymous_authors aa
           WHERE aa.content_type = _type
             AND aa.content_id = _id
             AND aa.author_id = auth.uid()
       );
$$;

REVOKE ALL ON FUNCTION public.is_anonymous_owner(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_anonymous_owner(text, uuid, uuid) TO authenticated;

-- Signup never trusts client-supplied role or password-policy metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        full_name,
        university_number,
        email,
        major,
        year,
        must_change_password
    )
    VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), 'مستخدم جديد'),
        COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'university_number', ''), 'PENDING-' || left(NEW.id::text, 8)),
        NEW.email,
        NULLIF(NEW.raw_user_meta_data ->> 'major', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'year', '')::integer,
        false
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles(user_id, role)
    VALUES (NEW.id, 'student'::public.app_role)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;

-- A forced password change is verified by comparing the stored Auth password
-- fingerprint, not by trusting a client-side profile update.
CREATE TABLE IF NOT EXISTS public.forced_password_change_state (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    password_fingerprint text NOT NULL,
    required_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.forced_password_change_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.forced_password_change_state FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.has_role(auth.uid(), 'admin'::public.app_role)
       OR current_setting('app.trusted_profile_update', true) = 'on'
       OR current_setting('app.allow_password_flag_change', true) = 'on' THEN
        RETURN NEW;
    END IF;

    NEW.points := OLD.points;
    NEW.banned := OLD.banned;
    NEW.suspended_until := OLD.suspended_until;
    NEW.warning_count := OLD.warning_count;
    NEW.verified := OLD.verified;
    NEW.must_change_password := OLD.must_change_password;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
END;
$$;

-- Snapshot existing password hashes for accounts already marked as requiring
-- a password change. OAuth-only accounts have no password to change.
INSERT INTO public.forced_password_change_state(user_id, password_fingerprint)
SELECT p.id, md5(u.encrypted_password)
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.must_change_password = true
  AND COALESCE(u.encrypted_password, '') <> ''
ON CONFLICT (user_id) DO NOTHING;

SELECT set_config('app.allow_password_flag_change', 'on', true);

UPDATE public.profiles p
SET must_change_password = false
FROM auth.users u
WHERE u.id = p.id
  AND p.must_change_password = true
  AND COALESCE(u.encrypted_password, '') = '';

CREATE OR REPLACE FUNCTION public.complete_forced_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_expected text;
    v_current text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT password_fingerprint
    INTO v_expected
    FROM public.forced_password_change_state
    WHERE user_id = auth.uid();

    IF v_expected IS NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND must_change_password = true
        ) THEN
            RAISE EXCEPTION 'Password change proof is missing; contact the administrator';
        END IF;
        RETURN;
    END IF;

    SELECT md5(encrypted_password)
    INTO v_current
    FROM auth.users
    WHERE id = auth.uid();

    IF v_current IS NULL OR v_current = v_expected THEN
        RAISE EXCEPTION 'Set a new password before completing this step';
    END IF;

    PERFORM set_config('app.allow_password_flag_change', 'on', true);

    UPDATE public.profiles
    SET must_change_password = false
    WHERE id = auth.uid();

    DELETE FROM public.forced_password_change_state
    WHERE user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_password_change_required(_user_id uuid, _required boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_fingerprint text;
BEGIN
    IF auth.uid() IS NULL
       OR NOT (
           public.is_main_admin(auth.uid())
           OR public.has_role(auth.uid(), 'admin'::public.app_role)
       ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF _required THEN
        SELECT md5(encrypted_password)
        INTO v_fingerprint
        FROM auth.users
        WHERE id = _user_id
          AND COALESCE(encrypted_password, '') <> '';

        IF v_fingerprint IS NULL THEN
            RAISE EXCEPTION 'This account has no password credential to force-change';
        END IF;

        INSERT INTO public.forced_password_change_state(user_id, password_fingerprint, required_at)
        VALUES (_user_id, v_fingerprint, now())
        ON CONFLICT (user_id)
        DO UPDATE SET
            password_fingerprint = EXCLUDED.password_fingerprint,
            required_at = EXCLUDED.required_at;
    ELSE
        DELETE FROM public.forced_password_change_state
        WHERE user_id = _user_id;
    END IF;

    PERFORM set_config('app.allow_password_flag_change', 'on', true);

    UPDATE public.profiles
    SET must_change_password = _required
    WHERE id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_forced_password_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_forced_password_change() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_password_change_required(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_password_change_required(uuid, boolean) TO authenticated;

-- User-scoped chat RPCs must never trust a caller-supplied user ID.
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conv_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    UPDATE public.conversation_members
    SET last_read_at = now()
    WHERE conversation_id = _conv_id
      AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_conversation(_conv_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    DELETE FROM public.conversation_members
    WHERE conversation_id = _conv_id
      AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_conversation(_conv_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = _conv_id
          AND (
              c.created_by = auth.uid()
              OR public.is_main_admin(auth.uid())
              OR public.has_role(auth.uid(), 'admin'::public.app_role)
          )
    ) THEN
        RAISE EXCEPTION 'Only the conversation creator or an administrator can delete it';
    END IF;

    DELETE FROM public.conversations
    WHERE id = _conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unread_message_count(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT count(*)::integer
    INTO v_count
    FROM public.messages m
    JOIN public.conversation_members cm
      ON cm.conversation_id = m.conversation_id
     AND cm.user_id = auth.uid()
    WHERE m.sender_id <> auth.uid()
      AND m.created_at > COALESCE(cm.last_read_at, 'epoch'::timestamptz);

    RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_conversation_unread_counts(_user_id uuid)
RETURNS TABLE(conversation_id uuid, unread_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT cm.conversation_id, count(m.id)::bigint
    FROM public.conversation_members cm
    JOIN public.messages m
      ON m.conversation_id = cm.conversation_id
    WHERE cm.user_id = auth.uid()
      AND m.sender_id <> auth.uid()
      AND m.created_at > COALESCE(cm.last_read_at, 'epoch'::timestamptz)
    GROUP BY cm.conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL
       AND (_user = auth.uid() OR public.is_main_admin(auth.uid()))
       AND EXISTS (
           SELECT 1
           FROM public.conversation_members cm
           WHERE cm.conversation_id = _conv
             AND cm.user_id = _user
       );
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_conversation(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_conversation(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_unread_message_count(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_conversation_unread_counts(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_conversation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_conversation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_message_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_unread_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;

-- Course and admin dashboard RPCs are authorized at the server boundary.
CREATE OR REPLACE FUNCTION public.get_daily_user_registrations(since timestamp with time zone)
RETURNS TABLE(day text, count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT (
        public.is_main_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT to_char(date_trunc('day', p.created_at), 'YYYY-MM-DD'), count(*)::bigint
    FROM public.profiles p
    WHERE p.created_at >= since
    GROUP BY date_trunc('day', p.created_at)
    ORDER BY date_trunc('day', p.created_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_posts(since timestamp with time zone)
RETURNS TABLE(day text, count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT (
        public.is_main_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT to_char(date_trunc('day', p.created_at), 'YYYY-MM-DD'), count(*)::bigint
    FROM public.posts p
    WHERE p.created_at >= since
    GROUP BY date_trunc('day', p.created_at)
    ORDER BY date_trunc('day', p.created_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_recent_admin_activity()
RETURNS TABLE(id uuid, activity_type text, description text, created_at timestamp with time zone, user_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_main_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT
        a.id,
        'admin_action'::text,
        a.action || ' - ' || COALESCE(p.full_name, ''),
        a.created_at,
        COALESCE(p.full_name, '')
    FROM public.admin_actions a
    LEFT JOIN public.profiles p ON a.target_user_id = p.id
    ORDER BY a.created_at DESC
    LIMIT 10;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_courses_with_counts()
RETURNS TABLE(
    id uuid,
    name text,
    major text,
    year integer,
    semester integer,
    teacher_name text,
    files_count bigint,
    links_count bigint,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT (
        public.is_main_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_subadmin_permission(auth.uid(), 'can_courses')
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.major,
        c.year,
        c.semester,
        COALESCE(p.full_name, 'غير محدد'),
        (SELECT count(*) FROM public.course_files cf WHERE cf.course_id = c.id),
        (SELECT count(*) FROM public.course_links cl WHERE cl.course_id = c.id),
        c.created_at
    FROM public.courses c
    LEFT JOIN public.profiles p ON p.id = c.teacher_id
    ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_anonymous_authors(_type text, _ids uuid[])
RETURNS TABLE(content_id uuid, author_id uuid, full_name text, avatar_url text, university_number text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT (
        public.is_main_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_subadmin_permission(auth.uid(), 'can_reports')
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT aa.content_id, aa.author_id, p.full_name, p.avatar_url, p.university_number
    FROM public.anonymous_authors aa
    JOIN public.profiles p ON p.id = aa.author_id
    WHERE aa.content_type = _type
      AND aa.content_id = ANY(_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_year(_user uuid, _year smallint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT (
        public.is_main_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_subadmin_permission(auth.uid(), 'can_users')
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF _year < 1 OR _year > 8 THEN
        RAISE EXCEPTION 'Invalid academic year';
    END IF;

    UPDATE public.profiles
    SET year = _year
    WHERE id = _user;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR _user = auth.uid() THEN
        RAISE EXCEPTION 'Invalid target user';
    END IF;

    IF _role = 'teacher'::public.app_role THEN
        IF NOT (
            public.is_main_admin(auth.uid())
            OR public.has_role(auth.uid(), 'admin'::public.app_role)
            OR public.has_subadmin_permission(auth.uid(), 'can_teachers')
        ) THEN
            RAISE EXCEPTION 'Not authorized to assign teacher role';
        END IF;
    ELSE
        IF NOT public.is_main_admin(auth.uid()) THEN
            RAISE EXCEPTION 'Only the main administrator can assign this role';
        END IF;
    END IF;

    DELETE FROM public.user_roles
    WHERE user_id = _user;

    INSERT INTO public.user_roles(user_id, role)
    VALUES (_user, _role);
END;
$$;

-- Existing admin mutation RPCs must not be callable anonymously.
REVOKE ALL ON FUNCTION public.admin_adjust_points(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_ban(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_teacher_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_verified(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_year(uuid, smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_suspend(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_unban(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_warn(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_adjust_points(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_teacher_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_verified(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_year(uuid, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suspend(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unban(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_warn(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_daily_user_registrations(timestamp with time zone) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_daily_posts(timestamp with time zone) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_recent_admin_activity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_courses_with_counts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_anonymous_authors(text, uuid[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_daily_user_registrations(timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_posts(timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_admin_activity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_courses_with_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_anonymous_authors(text, uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION public.award_points(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_points(uuid, integer) TO service_role;

-- Direct conversation membership changes are routed through create_dm/create_group
-- and the identity-checked leave/delete RPCs, never arbitrary table inserts.
DROP POLICY IF EXISTS "Members can add members" ON public.conversation_members;
DROP POLICY IF EXISTS conversation_members_insert ON public.conversation_members;
CREATE POLICY conversation_members_insert_via_rpc_only
ON public.conversation_members
FOR INSERT TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS conversations_insert_self ON public.conversations;
DROP POLICY IF EXISTS conversations_insert ON public.conversations;
CREATE POLICY conversations_insert_via_rpc_only
ON public.conversations
FOR INSERT TO authenticated
WITH CHECK (false);

REVOKE ALL ON FUNCTION public.create_dm(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_group(text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_dm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group(text, uuid[]) TO authenticated;

COMMIT;
