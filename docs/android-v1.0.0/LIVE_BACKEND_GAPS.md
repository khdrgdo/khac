# NEXUS — Live backend gaps and security blockers

**Source:** read-only Supabase catalog snapshot in `NEXUS_ANDROID_PARITY_AUDIT.md` (13 Nov 2026), cross-checked against all 39 SQL migrations currently in `main`. This is not a claim that every migration is applied to the live project. The snapshot explicitly shows differences between source migrations and live catalog.

## P0 — must be resolved before a production 1.0.0

1. **Signup role escalation remains live.** The live `handle_new_user` reads `role` and `must_change_password` from `raw_user_meta_data`. A client can submit privileged metadata. Migration `20260730000000_fix_signup_role_privilege_escalation.sql` contains a hardening fix, but the live function snapshot still shows the vulnerable body. Android must never send a role field; the live database must be migrated and tested before release.
2. **Arbitrary points mutation.** `award_points(uuid, integer)` is SECURITY DEFINER and EXECUTE is granted to PUBLIC/anon/authenticated. Its body accepts a target user and delta without checking the caller. It must be callable only by trusted trigger functions/service role, never directly by a client.
3. **Anonymous identity probing.** `is_anonymous_owner(text, uuid, uuid)` is executable by PUBLIC and accepts an arbitrary user ID. It can be used to test whether another account authored an anonymous post/comment. Restrict it to `auth.uid()` and authenticated callers.
4. **Chat identity spoofing.** `mark_conversation_read`, `leave_conversation`, `delete_conversation`, `get_unread_message_count`, and `get_conversation_unread_counts` are SECURITY DEFINER functions executable by PUBLIC and accept caller-supplied `_user_id` without enforcing `_user_id = auth.uid()`. This permits impersonated read-state changes, membership removal/deletion and unread-count queries.
5. **Mutable main-admin identity.** `is_main_admin` identifies the owner through profile fields (university number/email) instead of an immutable auth user UUID. A profile field must not be the root of trust for the whole institution.
6. **Public admin analytics.** `get_daily_user_registrations`, `get_daily_posts`, `get_recent_admin_activity`, and `get_courses_with_counts` are SECURITY DEFINER functions with public execute and no adequate role gate in their live definitions. They expose internal metrics/activity.
7. **Course write-policy overlap.** Several permissive RLS policies coexist. PostgreSQL combines permissive policies with OR; the broad teacher/sub-admin insert/update/delete policies defeat narrower ownership/staff policies. Course and course-link mutation is not consistently scoped to the assigned teacher or `can_courses`.
8. **Forged notification inserts.** The live `notifications` insert policy permits an authenticated user to set themselves as actor while selecting arbitrary recipients and content. It is not a safe activity-notification or broadcast API.

## P1 — permission, privacy and parity defects

9. **Sub-admin permission drift.** `get_anonymous_authors` allows every sub-admin to reveal anonymous authors instead of requiring `can_reports`. `admin_set_year` accepts any sub-admin instead of a dedicated user-management permission. `can_courses` does not consistently gate course creation. Reports, warnings and banned-word policies do not consistently match the UI permission toggles.
10. **Name-change feature is not deployed.** Migration `20260741000000_name_change_requests.sql` exists in source, but the live catalog snapshot has no `name_change_requests` table. The live `profiles` table also lacks `has_used_direct_name_change`. The web tab cannot be treated as live-ready until the migration is applied and generated types are refreshed.
11. **Activity notification RPC is absent.** The web notification store calls `get_my_activity_notifications`, but it is not present in the live function catalog. The app must not silently treat this as a working endpoint.
12. **Forced password change is inconsistent.** The live profile-protection trigger blocks ordinary users from changing `must_change_password`; the web flow attempts to clear it directly after password update. This can leave a user trapped in forced-change state. Use a narrowly scoped server RPC and test it end-to-end.
13. **Direct table writes bypass moderation checks.** The secure `create_post_as`/`create_comment_as` paths check account status, but direct insert policies still allow paths that do not consistently run those checks. Message sending checks blocks, but account suspension/banned-word enforcement is not uniformly server-side.
14. **Conversation membership can be over-broad.** The live membership insert policy permits an existing member to insert other users, without a strict group-only/creator invitation rule. A DM can potentially be expanded into a group without a deliberate conversion flow.
15. **Pinned-card authorization is coarse.** All sub-admins can manage pinned cards in the live policies; there is no corresponding sub-admin permission. Restrict to admin/main-admin until a dedicated permission exists.
16. **Broadcast and notification history disagree with RLS.** The web broadcast path inserts announcement rows, while the general user insert policy excludes announcements; admin history reads are constrained by recipient-oriented select policies. Replace direct writes with an admin-gated RPC and test history.
17. **Message reports and moderation views do not match sub-admin UI.** The live policies restrict message reports/warnings/post reports to admins in places where the UI suggests sub-admin moderation permissions should work. The Android permission model must follow a single server-enforced matrix.
18. **Public/profile data paths need a privacy contract.** Public profile RPCs expose fields conditionally; direct table reads for admin/sub-admin and search must not leak university numbers, email, hidden sub-admin accounts or anonymous authors.

## Required remediation order

1. Apply and verify the role-assignment hardening; bootstrap immutable main-admin UUID identity.
2. Close PUBLIC execute on privileged RPCs and enforce `auth.uid()` inside every user-scoped RPC.
3. Collapse duplicate permissive course policies; gate writes by owner/assigned teacher/admin/`can_courses`.
4. Add a single server-side permission matrix, including `can_users`; gate reports, warnings, anonymous-author disclosure, year changes and name requests.
5. Replace client-authored notifications/broadcasts with verified server RPCs and restore the missing activity notification contract.
6. Add server-side interaction guards for banned/suspended users and blocked words.
7. Deploy missing name-change schema and profile fields, regenerate Supabase types, and run RLS/RPC integration tests.
8. Only then wire the corresponding Android repositories and enable those screens in production.

**Safety boundary:** no live database writes or migration application were performed. The remediation is to be authored and tested on this branch first; applying it to the live Supabase project requires a separate approved deployment and a verified backup.
