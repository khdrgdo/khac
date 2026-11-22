# NEXUS 1.0.0 — 15 review passes

These passes compare the web source, the existing parity audit, the migration history and the live catalog snapshot. A feature is not considered implemented merely because a route or button exists.

| Pass | Review lens | Result / follow-up |
|---:|---|---|
| 1 | Repository inventory | Identified web source, Supabase migrations, generated types, assets and the Android module boundary |
| 2 | Route and navigation inventory | Mapped the primary destinations, profile menu, global search, notification popover and role-specific admin entry |
| 3 | Authentication lifecycle | Signup, email confirmation, email/Google sign-in, reset deep links, session restore, logout and incomplete-profile states |
| 4 | Identity and role assignment | Found live signup metadata role escalation and mutable main-admin identity; P0 remediation |
| 5 | Profile lifecycle | Public/private fields, hidden university number, avatar, bio, direct name change, request/approval and forced password change |
| 6 | Role matrix | Student, teacher, admin, main admin and sub-admin; found permission fields that UI and RLS do not consistently enforce |
| 7 | Admin dashboard | Enumerated metrics, user/teacher/course management, reports, banned words, sub-admins, logs, pinned card, broadcast and name requests |
| 8 | Admin RPC authorization | Checked SECURITY DEFINER bodies, role gates, execute grants and user-ID parameters; found public analytics and over-broad RPCs |
| 9 | Feed and post lifecycle | Create/edit/delete, anonymous author, image, reaction, save, report, tags, poll and accepted-answer behavior |
| 10 | Comment and moderation lifecycle | Threading, replies, accepted answers, report paths, warnings, suspension and banned-word enforcement |
| 11 | Messaging and conversation lifecycle | DM/group creation, membership, block/report, read state, unread counts, leave/delete and realtime; found user-ID spoofing |
| 12 | Notification lifecycle | Persisted notifications, synthesized activity notifications, local read/hidden state, broadcast and deep links; found missing RPC and RLS mismatch |
| 13 | Courses and learning content | Course ownership, teacher scope, materials, links, updates, discussions and schedules; found overlapping permissive policies |
| 14 | Data privacy and storage | Public profile RPCs, anonymous authors, course file buckets, avatar/image URLs, RLS and signed URL assumptions |
| 15 | Migration/live parity and build reproducibility | Compared all 39 source migrations with the read-only live catalog snapshot; identified unapplied schema and pinned API 36 toolchain compatibility through CI |

## Release gate

The Android implementation must not expose an operation until its repository contract and server authorization have been checked. The current branch is a foundation, not a release candidate. The first APK is not production-ready until the live-backend blockers, missing publishable key/redirect allowlist, complete feature screens, and device/integration tests are resolved.
