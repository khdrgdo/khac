-- NEXUS 1.0.0 — durable broadcasts, derived activity feed and pinned-card RPCs
-- Requires migrations 20261123000000 and 20261123000001.

BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_activity_state (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_id text NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    is_hidden boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, activity_id)
);

ALTER TABLE public.notification_activity_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_activity_state FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_activity_notification_state(
    _activity_id text,
    _is_read boolean,
    _is_hidden boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF _activity_id IS NULL OR length(_activity_id) < 3 OR length(_activity_id) > 200 THEN
        RAISE EXCEPTION 'Invalid activity identifier';
    END IF;

    INSERT INTO public.notification_activity_state(
        user_id, activity_id, is_read, is_hidden, updated_at
    )
    VALUES (
        auth.uid(), _activity_id, COALESCE(_is_read, false),
        COALESCE(_is_hidden, false), now()
    )
    ON CONFLICT (user_id, activity_id)
    DO UPDATE SET
        is_read = EXCLUDED.is_read,
        is_hidden = EXCLUDED.is_hidden,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_activity_notifications()
RETURNS TABLE(
    id text,
    recipient_id uuid,
    actor_id uuid,
    actor_name text,
    actor_avatar text,
    type text,
    priority text,
    title text,
    body text,
    link text,
    read boolean,
    hidden boolean,
    created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH activity AS (
        -- Top-level comments on the current user's posts and replies to their comments.
        SELECT
            'comment_' || c.id::text AS id,
            auth.uid() AS recipient_id,
            CASE WHEN ca.author_id IS NOT NULL THEN NULL ELSE c.author_id END AS actor_id,
            CASE
                WHEN ca.author_id IS NOT NULL THEN 'مستخدم مجهول'
                ELSE COALESCE(actor.full_name, 'زميل')
            END AS actor_name,
            CASE WHEN ca.author_id IS NOT NULL THEN NULL ELSE actor.avatar_url END AS actor_avatar,
            CASE WHEN c.parent_id IS NULL THEN 'post_comment' ELSE 'comment_reply' END AS type,
            'normal'::text AS priority,
            CASE WHEN c.parent_id IS NULL THEN 'تعليق جديد على منشورك' ELSE 'رد جديد على تعليقك' END AS title,
            c.content AS body,
            '/posts/' || p.id::text AS link,
            COALESCE(st.is_read, false) AS read,
            COALESCE(st.is_hidden, false) AS hidden,
            c.created_at
        FROM public.comments c
        JOIN public.posts p ON p.id = c.post_id
        LEFT JOIN public.comments parent ON parent.id = c.parent_id
        LEFT JOIN public.anonymous_authors ca
          ON ca.content_type = 'comment' AND ca.content_id = c.id
        LEFT JOIN public.anonymous_authors parent_anon
          ON parent_anon.content_type = 'comment' AND parent_anon.content_id = parent.id
        LEFT JOIN public.anonymous_authors post_anon
          ON post_anon.content_type = 'post' AND post_anon.content_id = p.id
        LEFT JOIN public.profiles actor
          ON actor.id = COALESCE(c.author_id, ca.author_id)
        LEFT JOIN public.notification_activity_state st
          ON st.user_id = auth.uid() AND st.activity_id = 'comment_' || c.id::text
        WHERE auth.uid() IS NOT NULL
          AND COALESCE(c.author_id, ca.author_id) IS DISTINCT FROM auth.uid()
          AND (
              (c.parent_id IS NOT NULL
               AND COALESCE(parent.author_id, parent_anon.author_id) = auth.uid())
              OR
              (c.parent_id IS NULL
               AND COALESCE(p.author_id, post_anon.author_id) = auth.uid())
          )

        UNION ALL

        -- Reactions on the current user's posts.
        SELECT
            'react_' || r.post_id::text || '_' || r.user_id::text,
            auth.uid(),
            r.user_id,
            COALESCE(actor.full_name, 'زميل'),
            actor.avatar_url,
            'post_like'::text,
            'normal'::text,
            'تفاعل جديد على منشورك'::text,
            COALESCE(r.reaction::text, 'تفاعل'),
            '/posts/' || p.id::text,
            COALESCE(st.is_read, false),
            COALESCE(st.is_hidden, false),
            r.created_at
        FROM public.post_reactions r
        JOIN public.posts p ON p.id = r.post_id
        LEFT JOIN public.anonymous_authors post_anon
          ON post_anon.content_type = 'post' AND post_anon.content_id = p.id
        LEFT JOIN public.profiles actor ON actor.id = r.user_id
        LEFT JOIN public.notification_activity_state st
          ON st.user_id = auth.uid()
         AND st.activity_id = 'react_' || r.post_id::text || '_' || r.user_id::text
        WHERE auth.uid() IS NOT NULL
          AND COALESCE(p.author_id, post_anon.author_id) = auth.uid()
          AND r.user_id <> auth.uid()

        UNION ALL

        -- New messages in conversations where the current user is a member.
        SELECT
            'msg_' || m.id::text,
            auth.uid(),
            m.sender_id,
            COALESCE(actor.full_name, 'زميل'),
            actor.avatar_url,
            'message'::text,
            'normal'::text,
            'رسالة جديدة'::text,
            m.content,
            '/messages?conversationId=' || m.conversation_id::text,
            COALESCE(st.is_read, m.created_at <= cm.last_read_at, false),
            COALESCE(st.is_hidden, false),
            m.created_at
        FROM public.messages m
        JOIN public.conversation_members cm
          ON cm.conversation_id = m.conversation_id
         AND cm.user_id = auth.uid()
        LEFT JOIN public.profiles actor ON actor.id = m.sender_id
        LEFT JOIN public.notification_activity_state st
          ON st.user_id = auth.uid()
         AND st.activity_id = 'msg_' || m.id::text
        WHERE auth.uid() IS NOT NULL
          AND m.sender_id <> auth.uid()
          AND m.created_at > now() - interval '90 days'

        UNION ALL

        -- Warnings are visible only to the affected user.
        SELECT
            'warn_' || w.id::text,
            auth.uid(),
            w.issued_by,
            COALESCE(actor.full_name, 'الإدارة'),
            actor.avatar_url,
            'warning'::text,
            'important'::text,
            'تنبيه إداري'::text,
            w.reason,
            '/profile'::text,
            COALESCE(st.is_read, false),
            COALESCE(st.is_hidden, false),
            w.created_at
        FROM public.user_warnings w
        LEFT JOIN public.profiles actor ON actor.id = w.issued_by
        LEFT JOIN public.notification_activity_state st
          ON st.user_id = auth.uid()
         AND st.activity_id = 'warn_' || w.id::text
        WHERE auth.uid() IS NOT NULL
          AND w.user_id = auth.uid()

        UNION ALL

        -- Accepted-answer points events are derived from the accepted answer relation.
        SELECT
            'points_' || c.id::text,
            auth.uid(),
            CASE WHEN post_anon.author_id IS NOT NULL THEN NULL ELSE p.author_id END,
            CASE
                WHEN post_anon.author_id IS NOT NULL THEN 'مستخدم مجهول'
                ELSE COALESCE(actor.full_name, 'زميل')
            END,
            CASE WHEN post_anon.author_id IS NOT NULL THEN NULL ELSE actor.avatar_url END,
            'points_awarded'::text,
            'important'::text,
            'تم اختيار إجابتك كحل نموذجي! 🏆'::text,
            'حصلت على نقاط تميز أكاديمي بعد اختيار إجابتك.'::text,
            '/posts/' || p.id::text,
            COALESCE(st.is_read, false),
            COALESCE(st.is_hidden, false),
            p.updated_at
        FROM public.posts p
        JOIN public.comments c ON c.id = p.accepted_answer_id
        LEFT JOIN public.anonymous_authors post_anon
          ON post_anon.content_type = 'post' AND post_anon.content_id = p.id
        LEFT JOIN public.anonymous_authors comment_anon
          ON comment_anon.content_type = 'comment' AND comment_anon.content_id = c.id
        LEFT JOIN public.profiles actor
          ON actor.id = COALESCE(p.author_id, post_anon.author_id)
        LEFT JOIN public.notification_activity_state st
          ON st.user_id = auth.uid()
         AND st.activity_id = 'points_' || c.id::text
        WHERE auth.uid() IS NOT NULL
          AND COALESCE(c.author_id, comment_anon.author_id) = auth.uid()
          AND COALESCE(p.author_id, post_anon.author_id) IS DISTINCT FROM auth.uid()
    )
    SELECT
        activity.id,
        activity.recipient_id,
        activity.actor_id,
        activity.actor_name,
        activity.actor_avatar,
        activity.type,
        activity.priority,
        activity.title,
        activity.body,
        activity.link,
        activity.read,
        activity.hidden,
        activity.created_at
    FROM activity
    WHERE activity.created_at > now() - interval '90 days'
    ORDER BY activity.created_at DESC
    LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.set_activity_notification_state(text, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_activity_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_activity_notification_state(text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_activity_notifications() TO authenticated;

-- Admin broadcasts are persisted, but the sender identity is always auth.uid().
CREATE OR REPLACE FUNCTION public.admin_broadcast_notifications(
    _recipient_ids uuid[],
    _type text,
    _title text,
    _body text,
    _link text DEFAULT NULL,
    _priority text DEFAULT 'normal'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_name text;
    v_actor_avatar text;
    v_count integer := 0;
    v_unique_ids uuid[];
BEGIN
    IF auth.uid() IS NULL OR NOT (
        public.is_main_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    ) THEN
        RAISE EXCEPTION 'Not authorized to broadcast notifications';
    END IF;

    IF _type NOT IN ('announcement', 'course_added', 'material_added') THEN
        RAISE EXCEPTION 'Unsupported broadcast notification type';
    END IF;

    IF _priority NOT IN ('urgent', 'important', 'normal') THEN
        RAISE EXCEPTION 'Invalid notification priority';
    END IF;

    IF length(trim(COALESCE(_title, ''))) < 2 OR length(_title) > 140 THEN
        RAISE EXCEPTION 'Invalid notification title';
    END IF;

    IF length(trim(COALESCE(_body, ''))) < 2 OR length(_body) > 3000 THEN
        RAISE EXCEPTION 'Invalid notification body';
    END IF;

    IF COALESCE(cardinality(_recipient_ids), 0) > 1000 THEN
        RAISE EXCEPTION 'Too many notification recipients';
    END IF;

    SELECT COALESCE(array_agg(DISTINCT target_id), ARRAY[]::uuid[])
    INTO v_unique_ids
    FROM unnest(COALESCE(_recipient_ids, ARRAY[]::uuid[])) AS target_id;

    SELECT full_name, avatar_url
    INTO v_actor_name, v_actor_avatar
    FROM public.profiles
    WHERE id = auth.uid();

    INSERT INTO public.notifications (
        id, recipient_id, actor_id, actor_name, actor_avatar,
        type, priority, title, body, link, read, created_at
    )
    SELECT
        gen_random_uuid()::text,
        p.id,
        auth.uid(),
        COALESCE(v_actor_name, 'الإدارة'),
        v_actor_avatar,
        _type,
        _priority,
        trim(_title),
        trim(_body),
        NULLIF(trim(COALESCE(_link, '')), ''),
        false,
        now()
    FROM public.profiles p
    WHERE p.id = ANY(v_unique_ids)
      AND p.id <> auth.uid();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_broadcast_notifications(uuid[], text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_broadcast_notifications(uuid[], text, text, text, text, text) TO authenticated;

-- Pinned-card participation and poll votes are narrow RPCs. They verify the
-- caller identity and update only their respective JSON fields.
CREATE OR REPLACE FUNCTION public.toggle_pinned_card_participation(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_participants jsonb;
    v_enabled boolean;
    v_end_date timestamptz;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT participants, enabled, end_date
    INTO current_participants, v_enabled, v_end_date
    FROM public.pinned_cards
    WHERE id = 'pinned_featured_event_1'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pinned card not found';
    END IF;
    IF NOT COALESCE(v_enabled, false) THEN
        RAISE EXCEPTION 'This event is not active';
    END IF;
    IF v_end_date IS NOT NULL AND v_end_date < now() THEN
        RAISE EXCEPTION 'This event has ended';
    END IF;

    current_participants := COALESCE(current_participants, '[]'::jsonb);

    IF current_participants @> jsonb_build_array(p_user_id::text) THEN
        SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
        INTO current_participants
        FROM jsonb_array_elements(current_participants) item
        WHERE item <> to_jsonb(p_user_id::text);
    ELSE
        current_participants := current_participants || jsonb_build_array(p_user_id::text);
    END IF;

    UPDATE public.pinned_cards
    SET participants = current_participants,
        updated_at = now()
    WHERE id = 'pinned_featured_event_1';

    RETURN current_participants;
END;
$$;

CREATE OR REPLACE FUNCTION public.vote_on_poll(p_user_id uuid, p_option_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_votes jsonb;
    available_options jsonb;
    v_enabled boolean;
    v_end_date timestamptz;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT votes, poll_options, enabled, end_date
    INTO current_votes, available_options, v_enabled, v_end_date
    FROM public.pinned_cards
    WHERE id = 'pinned_featured_event_1'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pinned card not found';
    END IF;
    IF NOT COALESCE(v_enabled, false) THEN
        RAISE EXCEPTION 'This poll is not active';
    END IF;
    IF v_end_date IS NOT NULL AND v_end_date < now() THEN
        RAISE EXCEPTION 'This poll has ended';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(available_options, '[]'::jsonb)) option_row
        WHERE option_row ->> 'id' = p_option_id
    ) THEN
        RAISE EXCEPTION 'Invalid poll option';
    END IF;

    current_votes := jsonb_set(
        COALESCE(current_votes, '{}'::jsonb),
        ARRAY[p_user_id::text],
        to_jsonb(p_option_id),
        true
    );

    UPDATE public.pinned_cards
    SET votes = current_votes,
        updated_at = now()
    WHERE id = 'pinned_featured_event_1';

    RETURN current_votes;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_pinned_card_participation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vote_on_poll(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_pinned_card_participation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vote_on_poll(uuid, text) TO authenticated;

COMMIT;
