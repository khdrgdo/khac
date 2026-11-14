# NEXUS Admin Audit — 14 Nov 2026

## Existing admin sections found
The current `admin.tsx` contains ten sections, with visibility conditional on the current admin/sub-admin role:
1. البلاغات
2. المستخدمون
3. سجل النشاط
4. الأساتذة
5. الكلمات المحظورة
6. حسابات المساعدين
7. المقررات الدراسية
8. الكارد المثبت والأحداث
9. إرسال إشعار للطلاب
10. طلبات تغيير الأسماء

One top-level action currently responds with `toast.info("قريباً")`; this is not an implemented action and must either be completed or removed from the visible UI.

## Structural problems
- Ten horizontally scrolling tabs are a poor primary navigation model for an admin workspace, especially on mobile.
- There is no clear operational overview as the default landing area.
- The page uses hard-coded indigo active-state styling, inconsistent with the new NEXUS semantic design tokens.
- The UI does not establish a consistent table pattern for search, filtering, sorting, pagination, row actions, and bulk operations.
- Role-based tab visibility is not proof of authorization. Every mutation must be enforced by server-side checks and database policies.
- Broadcast notifications need delivery state and error reporting, not just a submit confirmation.
- Activity logs need filtering, actor/target details, and export.
- Moderation needs explicit queue states, reasons, reviewer attribution, and an audit trail.

## Target admin information architecture
- **Overview:** active users, new accounts, posts, reports awaiting review, unresolved questions, recent admin actions, and system status.
- **People:** users, teachers, sub-admins, profile/name requests, role and account status.
- **Moderation:** reports, flagged content, banned words, decisions, and appeal history.
- **Academic content:** courses, materials, pinned content, and events.
- **Communications:** broadcast notifications, audience selection, preview, schedule, delivery status, and retry.
- **Audit and security:** searchable activity log, permission matrix, suspicious actions, and export.

## Required implementation order
1. Audit every admin query and mutation for RLS/server-side authorization.
2. Build an explicit role-permission matrix and test each role against every action.
3. Replace the horizontal tab strip with a responsive sidebar/drawer and a true overview page.
4. Standardize data tables: search, filters, sorting, pagination, empty/loading/error states, row details, bulk actions.
5. Add confirmation and undo patterns for destructive or high-impact operations.
6. Add audit records for every admin mutation and show the actor, target, timestamp, and result.
7. Verify broadcast delivery and notification persistence end-to-end.

## Acceptance criteria
- Hiding a tab never substitutes for server authorization.
- No visible "coming soon" action remains.
- Every admin operation has a loading state, success/error result, and audit trail.
- The interface remains usable on a phone without horizontal tab hunting.
- A sub-admin can only perform explicitly granted operations; direct API calls must enforce the same boundaries.
