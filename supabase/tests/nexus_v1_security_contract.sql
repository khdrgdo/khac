BEGIN;
SELECT plan(23);

SELECT has_table('public', 'system_admins', 'main-admin identity table exists');
SELECT has_table('public', 'forced_password_change_state', 'forced password-change state exists');
SELECT has_table('public', 'name_change_requests', 'name-change request workflow exists');
SELECT has_table('public', 'notification_activity_state', 'per-user activity notification state exists');

SELECT has_column('public', 'subadmin_permissions', 'can_users', 'user-management permission exists');
SELECT has_column('public', 'profiles', 'has_used_direct_name_change', 'one-time name-change flag exists');

SELECT has_function('public', 'complete_profile', ARRAY['text', 'text', 'public.major_code', 'smallint'], 'profile completion is server controlled');
SELECT has_function('public', 'direct_name_change', ARRAY['text'], 'one-time direct name change RPC exists');
SELECT has_function('public', 'admin_process_name_change_request', ARRAY['uuid', 'boolean', 'text'], 'admin name-change decision RPC exists');
SELECT has_function('public', 'complete_forced_password_change', ARRAY[]::text[], 'forced password-change completion RPC exists');
SELECT has_function('public', 'resolve_login_email', ARRAY['text'], 'numeric login identifier resolution exists');
SELECT has_function('public', 'get_my_activity_notifications', ARRAY[]::text[], 'activity feed is server derived');
SELECT has_function('public', 'set_activity_notification_state', ARRAY['text', 'boolean', 'boolean'], 'activity read and dismissal state is persisted');
SELECT has_function('public', 'admin_broadcast_notifications', ARRAY['uuid[]', 'text', 'text', 'text', 'text', 'text'], 'admin broadcast RPC exists');
SELECT has_function('public', 'notify_course_event', ARRAY['uuid', 'uuid', 'text'], 'course event notifications are scoped');
SELECT has_function('public', 'toggle_pinned_card_participation', ARRAY['uuid'], 'pinned-card participation RPC exists');
SELECT has_function('public', 'vote_on_poll', ARRAY['uuid', 'text'], 'pinned-card poll RPC exists');

SELECT has_policy('public', 'conversation_members', 'conversation_members_insert_via_rpc_only', 'conversation membership is created through RPC');
SELECT has_policy('public', 'posts', 'posts_insert_via_rpc_only', 'posts are created through moderated RPC');
SELECT has_policy('public', 'comments', 'comments_insert_via_rpc_only', 'comments are created through moderated RPC');
SELECT has_policy('public', 'notifications', 'notifications_select_sent_by_admin', 'admins can inspect their own sent broadcasts');

SELECT ok(
    (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notification_activity_state'::regclass),
    'activity notification state has RLS enabled'
);

SELECT is(
    (SELECT count(*)::integer FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'notifications'
       AND policyname IN ('Admins can insert notifications', 'Users can send genuine notifications', 'Admins can delete any notification')),
    0,
    'legacy permissive notification policies are removed'
);

SELECT is(
    (SELECT count(*)::integer FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'pinned_cards'
       AND policyname = 'Users can update their pinned card interaction'),
    0,
    'unrestricted pinned-card update policy is removed'
);

SELECT * FROM finish();
ROLLBACK;
