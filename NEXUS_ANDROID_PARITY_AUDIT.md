# NEXUS — تدقيق التكافؤ لتطبيق Android الأصلي (قراءة فقط)

> التاريخ: 2026-11-13. لم يُعدَّل أي ملف منتج أو migration أو RLS أو بيانات. المصدر: قراءة الكود، ملفات `supabase/migrations`، واستعلامات SELECT على كتالوج قاعدة البيانات الحية. لم تُنفَّذ أي عمليات كتابة أو RPC.
> مفتاح الحالة: CONFIRMED WORKING / PARTIAL / UI-ONLY / BROKEN / UNVERIFIED. «PARTIAL» تعني أن المسار موجود في الكود والقاعدة لكن به فجوات أو لم يُختبر تفاعلياً.
> الأقسام التفصيلية أدناه بالإنجليزية لتُنسخ مباشرة إلى مواصفات Kotlin/Compose (أسماء الأعمدة والدوال حرفية).

## 1. الملخص التنفيذي — أخطر النتائج (مؤكدة من الكود/الكتالوج)

### أمنية حرجة
1. **تصعيد صلاحيات عند التسجيل**: `handle_new_user` يقرأ `raw_user_meta_data->>'role'` ويُدرجه في `user_roles` دون قائمة مسموحة → أي مسجّل يمكنه طلب `admin`. (القسم 5)
2. **دوال المحادثات تثق بمعرّف المستخدم القادم من العميل**: `mark_conversation_read`, `leave_conversation`, `delete_conversation`, `get_unread_message_count`, `get_conversation_unread_counts` كلها `SECURITY DEFINER` وتأخذ `_user_id` بلا مقارنة مع `auth.uid()`، وصلاحية التنفيذ PUBLIC. يمكن لأي مستدعٍ إخراج آخرين من محادثاتهم أو حذف محادثات بانتحال المنشئ أو قراءة عدادات غيره. (القسم 3)
3. **الأدمن الرئيسي مربوط برقم جامعي قابل للتعديل**: `is_main_admin` يعتمد على `profiles.university_number='2011099840'` أو الإيميل؛ trigger الحماية يحمي الإيميل لكن لا يحمي `university_number`. (القسم 5)
4. **الإيقاف والكلمات المحظورة مفروضة في الواجهة فقط** للرسائل والتعليقات المباشرة؛ RLS لا تمنعها (الاستثناء: `create_post_as`/`create_comment_as` تفحص الإيقاف). على تطبيق Android ألا يعتبر هذه قيوداً من الخادم.
5. **مخازن الملفات "خاصة" اسمياً**: `avatars` و`course-files` مسموح قراءتها لأي مستخدم مسجّل؛ صلاحيات الأساتذة في المقررات أوسع في القاعدة من الواجهة. (القسمان 1 و4)

### ميزات معطلة أو واجهة فقط
- **طلبات تغيير الاسم: BROKEN** — جدول `name_change_requests` وعمود `profiles.has_used_direct_name_change` غير موجودين في القاعدة الحية؛ الأخطاء تُبتلع فتظهر قائمة فارغة.
- **إلزام تغيير كلمة المرور الأولى: BROKEN** — الحارس لا يفرضه، والمستخدم لا يستطيع مسح `must_change_password` بنفسه (يحميه trigger).
- **OTP غير موجود في الواجهة**؛ الاسترداد عبر رابط بريد فقط.
- **تفاعلات التعليقات محلية (localStorage) فقط**.
- **قراءة/إخفاء الإشعارات الاصطناعية محلية فقط**؛ لا يوجد Web Push حقيقي (إشعارات المتصفح أثناء فتح الصفحة فقط).
- **استهداف البطاقة المثبتة (سنة/تخصص) يُحفظ ولا يُطبَّق**؛ الموعد النهائي لا يوقف التصويت؛ أزرار «مسح الأصوات/المشاركين» لا تمسح شيئاً فعلياً؛ جدول `pinned_cards` غير مضاف للـrealtime.
- **صلاحيات المشرف الست غير متسقة**: الواجهة تعرض تبويبات (الكلمات المحظورة، البلاغات) بينما RLS تسمح للأدمن فقط؛ `can_courses` لا يفتح تبويب المقررات في لوحة الإدارة.
- **الثيم العام للموقع** في localStorage فقط (عمود `profiles.theme` موجود لكن غير مستخدم كمصدر حقيقي).
- **بحث الإدارة**: الضغط على مستخدم لا يفتح ملفه.
- لا مرفقات في الرسائل، ولا مؤشر كتابة، ولا إيصالات قراءة لكل رسالة.

## 2. توصيات لتطبيق Android (لا تعتمد على ما يلي حتى يُصلح في الخادم)
- استخدم RPCs `create_post_as` / `create_comment_as` دائماً (تفرض الإيقاف وتدعم المجهول)، `create_dm`، `create_group`، `vote_on_poll`، `toggle_pinned_card_participation`.
- مرّر دائماً `auth.uid()` الحقيقي لدوال المحادثات، لكن اعتبرها غير آمنة حتى تُصلح.
- طبّق فلترة الكلمات المحظورة وحالة الإيقاف محلياً كما يفعل الموقع، مع العلم أنها ليست حماية.
- لا تبنِ شاشة طلبات تغيير الاسم ولا OTP ولا Push حتى تتوفر في الخادم (Push يحتاج FCM + جدول رموز أجهزة غير موجود).
- الرابط العميق الوحيد المقبول: `com.nexus.app://login-callback#access_token=…&refresh_token=…&expires_in=…&token_type=bearer`.
- الصور كلها في مخازن خاصة → اطلب روابط موقّعة (`createSignedUrl`) لـ `post-images`, `avatars`, `course-files`.

## 3. إصلاحات خادم مقترحة (لم تُطبَّق)
1. قصر الدور في `handle_new_user` على `student` (والأستاذ عبر دالة إدارية فقط).
2. إعادة كتابة دوال المحادثات الخمس لتستخدم `auth.uid()` وسحب EXECUTE من PUBLIC/anon.
3. حماية `university_number` في trigger الحماية، أو ربط `is_main_admin` بالمعرّف `id`.
4. فرض الإيقاف والكلمات المحظورة في RLS/triggers للرسائل والتعليقات والمنشورات.
5. إنشاء `name_change_requests` أو إزالة الميزة؛ دالة لمسح `must_change_password` بعد تغيير كلمة المرور.
6. فرض الاستهداف والموعد في RPCs البطاقة؛ إضافة `pinned_cards` للـrealtime.
7. مواءمة RLS مع صلاحيات المشرفين الست؛ تضييق سياسات قراءة المخازن.

---


---

# AUTH & PROFILE audit

## Scope and evidence
Read-only review of requested routes, helpers, components, generated types, relevant Supabase migrations, and live `public` table listing/schema via SELECT-only psql. No project files modified. `psql \dt public.*` shows no `public.name_change_requests`; direct information_schema check shows its absence as well. This means migration source contains the table definition but the connected database does not currently have it.

## Findings by feature

### University-number/password login — **PARTIAL**
- **Route/component/flow:** `/auth`, `LoginForm`; a numeric login identifier is transformed through `universityNumberToEmail(value)` and passed to `supabase.auth.signInWithPassword({email,password})`. `universityNumberToEmail` creates `${num.trim()}@college.edu`. Non-numeric identifiers without `@` become normalized `@subadmin.edu` addresses, optionally stripping `sub_`. [src/routes/auth.tsx:254-290](src/routes/auth.tsx#L254-L290), [src/lib/college.ts:24-32](src/lib/college.ts#L24-L32)
- **Permission/enforcement:** Supabase Auth password authentication; not a client-only credential check. Login distinguishes unconfirmed-email errors and shows generic invalid-credentials errors. [src/routes/auth.tsx:290-312](src/routes/auth.tsx#L290-L312)
- **DB/auth details:** synthetic email domain is `college.edu`; signup uses a separately supplied real email (see below). Migration signup trigger stores profile university number from auth metadata, while profile `email` is included by the later trigger. [supabase/migrations/20260717122157_10b40ca7-c9f5-456c-88b3-7d7cdf968d9a.sql:156-171](supabase/migrations/20260717122157_10b40ca7-c9f5-456c-88b3-7d7cdf968d9a.sql#L156-L171)
- **Risk/uncertainty:** ordinary signup stores the entered email, not an evident `number@college.edu` Auth email, so that user cannot obviously use the numeric-login conversion for normal student accounts. That convention may depend on unseen provisioning/edge configuration; not demonstrated by the inspected signup path. **PARTIAL**, not confirmed end-to-end.

### Signup / initial password — **PARTIAL (initial-password claim contradicted)**
- **Flow:** signup asks for university number (5+ chars), personal email, name, major, year, and user-chosen password (6+ chars), then `supabase.auth.signUp` passes `email.trim()` and that password. Metadata includes `university_number`, `full_name`, `major`, `year`, `role: student`, `must_change_password: false`. On immediate session it completes auth; otherwise displays email-confirmation instructions. [src/routes/auth.tsx:448-547](src/routes/auth.tsx#L448-L547)
- **First password:** not the university number on this self-signup route: the user explicitly chooses a password. `must_change_password` is false in submitted metadata. [src/routes/auth.tsx:496-517](src/routes/auth.tsx#L496-L517)
- **Security:** signup role metadata is untrusted by definition; migration `20260730000000_fix_signup_role_privilege_escalation.sql` must be consulted for role handling. User-facing device-account check is ineffective because `deviceGuard` always allows and has no-op bind/clear. [src/routes/auth.tsx:470-478](src/routes/auth.tsx#L470-L478), [src/lib/deviceGuard.ts:1-23](src/lib/deviceGuard.ts#L1-L23)
- **Errors/empty:** required-field checks, duplicate-email messaging, errors, and email confirmation waiting UI exist. [src/routes/auth.tsx:480-547](src/routes/auth.tsx#L480-L547)

### Mandatory password change — **BROKEN enforcement / PARTIAL workflow**
- **Flow:** authenticated `/change-password` calls `supabase.auth.updateUser({password})`, then, if local profile state has `must_change_password`, directly updates `profiles.must_change_password=false`, and navigates to `/feed`. [src/routes/_authenticated/change-password.tsx:23-43](src/routes/_authenticated/change-password.tsx#L23-L43)
- **Route guard:** `_authenticated/route.tsx` only checks whether a session exists; it neither redirects based on `must_change_password` nor forces users onto change-password. [src/routes/_authenticated/route.tsx:16-45](src/routes/_authenticated/route.tsx#L16-L45)
- **DB contradiction:** profile protection trigger restores `must_change_password` to OLD value for non-admins, so the client’s clear-flag update is silently negated (the route ignores update error too). It also protects `email`, `points`, ban/suspension/warning, and verified. [supabase/migrations/20260722000000_verified_badge_and_column_protection.sql:17-35](supabase/migrations/20260722000000_verified_badge_and_column_protection.sql#L17-L35)
- **Status:** users can change password in Auth, but cannot self-clear the required flag under this trigger and are not forced to do so. The initial password `= university number` behavior was not found in signup UI; currently signup takes a user-chosen password. **BROKEN** for enforcement/flag clearance.

### Google OAuth — **PARTIAL / environment-unverified**
- **Flow:** `/auth` first calls `lovable.auth.signInWithOAuth("google", {redirect_uri: origin + "/auth"})`; on returned error or thrown error it falls back to Supabase `signInWithOAuth({provider:"google", options:{redirectTo: origin + "/auth"}})`. [src/routes/auth.tsx:100-122](src/routes/auth.tsx#L100-L122)
- **Profile:** auth context attempts to create a missing profile with random `U######` university placeholder; completion flow recognizes `U`-prefixed values as incomplete. [src/hooks/useAuth.tsx:93-117](src/hooks/useAuth.tsx#L93-L117), [src/routes/_authenticated/complete-profile.tsx:48-59](src/routes/_authenticated/complete-profile.tsx#L48-L59)
- **Status:** code path exists; OAuth provider credentials/callback configuration and actual successful roundtrip were not verified.

### Profile completion — **PARTIAL**
- **Route/flow:** authenticated `/complete-profile` collects university number (5+ length), full name, major, year; updates `profiles.university_number`, `full_name`, `major`, `year` filtered by `id`, then refreshes profile and routes to feed or mobile callback. [src/routes/_authenticated/complete-profile.tsx:39-59](src/routes/_authenticated/complete-profile.tsx#L39-L59), [src/routes/_authenticated/complete-profile.tsx:61-114](src/routes/_authenticated/complete-profile.tsx#L61-L114)
- **Permissions:** `_authenticated` session guard is UI/router-layer; profile RLS update self policy is DB-side. [src/routes/_authenticated/route.tsx:16-45](src/routes/_authenticated/route.tsx#L16-L45), [supabase/migrations/20260716015956_4522f137-222f-4cdb-8429-68cf30514785.sql:174-177](supabase/migrations/20260716015956_4522f137-222f-4cdb-8429-68cf30514785.sql#L174-L177)
- **Errors:** duplicate university number has specific message, other database errors surfaced; loading state present. [src/routes/_authenticated/complete-profile.tsx:63-114](src/routes/_authenticated/complete-profile.tsx#L63-L114)
- **Gap:** route is not required by general auth guard; completion enforcement is only in some post-auth callback decision points.

### Password reset and OTP — **PARTIAL; OTP is not implemented in UI**
- **Request:** auth page reset dialog accepts an email address and calls `supabase.auth.resetPasswordForEmail(email.trim(), {redirectTo: origin + "/reset-password"})`. No university-number-to-email transformation here, so users must know/provide the actual email. [src/routes/auth.tsx:386-401](src/routes/auth.tsx#L386-L401)
- **Completion:** `/reset-password` checks `supabase.auth.getSession()` once and again after 300ms for recovery session, then `updateUser({password})`; it does not call `verifyOtp` or collect/verify an OTP. It relies on Supabase recovery link/token processing and reports expired/invalid link if no session. [src/routes/reset-password.tsx:22-40](src/routes/reset-password.tsx#L22-L40), [src/routes/reset-password.tsx:42-60](src/routes/reset-password.tsx#L42-L60)
- **Status:** real reset-link/recovery-session pattern, not manual OTP input/verification. Runtime Supabase link behavior not tested.

### Profile view/edit — **PARTIAL**
- **Route:** `/_authenticated/profile/$id`, route file `profile.$id.tsx`; self selects `profiles.*`; other-user profile uses RPC `get_public_profiles({_ids:[id]})`, then tries direct `profiles.theme` read and fallback local theme mapping. Also queries `user_roles.role` by `user_id`. [src/routes/_authenticated/profile.$id.tsx:42-82](src/routes/_authenticated/profile.$id.tsx#L42-L82)
- **RPC/schema:** `get_public_profiles(_ids uuid[])` is defined by migration and returns profile fields including `id, full_name, avatar_url, major, year, bio, points, university_number, verified`. The privacy migration masks university number when `hide_university_number` is true. [supabase/migrations/20260743000000_hide_univ_number.sql:2-39](supabase/migrations/20260743000000_hide_univ_number.sql#L2-L39)
- **Privacy contradiction:** live `profiles` has a broad SELECT policy from initial migration (`USING(true)`), but later security changes are described in migration comments as locking SELECT; the `get_public_profiles` safe RPC exists. The reviewed live schema/policy state was not queried for `pg_policies`; treat direct reads in the profile route as potentially policy-sensitive. Separately, route’s direct `.select("theme")` for another user conflicts with the goal of safe RPC and may fail under restrictive RLS; it catches and falls back localStorage. [src/routes/_authenticated/profile.$id.tsx:55-68](src/routes/_authenticated/profile.$id.tsx#L55-L68), [supabase/migrations/20260716015956_4522f137-222f-4cdb-8429-68cf30514785.sql:174-177](supabase/migrations/20260716015956_4522f137-222f-4cdb-8429-68cf30514785.sql#L174-L177)
- **Edits:** card allows direct name change first time / request thereafter, bio edit, theme changes; exact name logic evidence below. Error toast surfaced for name/bio/theme write failures. [src/components/ProfileCardFrame.tsx:160-209](src/components/ProfileCardFrame.tsx#L160-L209), [src/components/ProfileCardFrame.tsx:246-257](src/components/ProfileCardFrame.tsx#L246-L257)
- **Status:** basic profile display and self-edit implemented; cross-user reads, restrictions, and persisted theme are inconsistent, so **PARTIAL**.

### Avatar upload / private bucket — **PARTIAL; private-access contract contradicted**
- **Flow:** profile route uploads through `uploadFile("avatars", user.id, file, "avatar-")`, writes returned object path into `profiles.avatar_url`, and UserAvatar signs non-HTTP paths using bucket `avatars`, 1800 seconds. [src/routes/_authenticated/profile.$id.tsx:282-285](src/routes/_authenticated/profile.$id.tsx#L282-L285), [src/lib/storage.ts:3-10](src/lib/storage.ts#L3-L10), [src/lib/storage.ts:27-37](src/lib/storage.ts#L27-L37), [src/components/UserAvatar.tsx:13-21](src/components/UserAvatar.tsx#L13-L21)
- **Storage policies:** migration defines authenticated SELECT for all objects in `avatars`; INSERT/UPDATE/DELETE restrict object path first folder to `auth.uid()`. This is not a private per-owner read policy; all authenticated users can read objects and clients create signed URLs. [supabase/migrations/20260719001541_3e5afc9f-636a-4b44-b3f3-b5cef1ad491d.sql:62-68](supabase/migrations/20260719001541_3e5afc9f-636a-4b44-b3f3-b5cef1ad491d.sql#L62-L68)
- **Status:** uploads and signed reads are implemented but not runtime-tested; “private” claim is contradicted by broad authenticated SELECT. Upload helper checks no MIME/size constraints.

### Name-change requests — **BROKEN in connected DB; local code handles errors silently**
- **Table and columns:** migration creates `name_change_requests`: `id, user_id, current_name, requested_name, reason, contact_info, status, created_at, processed_at`, later `university_number`; RLS self SELECT/INSERT, admin/sub-admin SELECT/UPDATE. [supabase/migrations/20260741000000_name_change_requests.sql:1-37](supabase/migrations/20260741000000_name_change_requests.sql#L1-L37)
- **Live DB:** `psql \dt public.*` and information_schema both show no `name_change_requests` table. Thus app calls to `.from("name_change_requests")` cannot work against the connected database. This is confirmed missing live schema, not merely missing generated type. [src/lib/nameChangeRequests.ts:43-75](src/lib/nameChangeRequests.ts#L43-L75)
- **Client behavior:** helper also queries/updates `profiles.has_used_direct_name_change`, but live profiles columns do not include it; migration source adds it at `20260741000000_name_change_requests.sql:35`, but connected DB does not. Helpers swallow errors and return `[]`, `null`, or `false`. [src/lib/nameChangeRequests.ts:21-40](src/lib/nameChangeRequests.ts#L21-L40), [src/lib/nameChangeRequests.ts:43-75](src/lib/nameChangeRequests.ts#L43-L75)
- **Review flow:** approve first changes request status then updates profile `full_name` in a separate statement; failure of name update only logs warning, leaving approved request without name change. [src/lib/nameChangeRequests.ts:79-107](src/lib/nameChangeRequests.ts#L79-L107)
- **Status:** broken in connected DB; app may incorrectly interpret failed `has_used_direct_change` read as “unused” and allow direct change.

### Hide university number — **PARTIAL / helper errors fail open**
- **Flow:** `privacy.ts` reads `profiles.hide_university_number, university_number`; setting updates `hide_university_number` and the number (removing any legacy `HIDDEN_` prefix), dispatches browser event. Formatting helper masks for UI. [src/lib/privacy.ts:3-19](src/lib/privacy.ts#L3-L19), [src/lib/privacy.ts:21-50](src/lib/privacy.ts#L21-L50), [src/lib/privacy.ts:53-71](src/lib/privacy.ts#L53-L71)
- **DB enforcement:** `get_public_profiles`, `search_public_profiles`, and `get_leaderboard_profiles` mask via `CASE WHEN hide_university_number THEN NULL`; safe RPCs therefore enforce privacy for those readers, not just presentation. [supabase/migrations/20260743000000_hide_univ_number.sql:20-29](supabase/migrations/20260743000000_hide_univ_number.sql#L20-L29), [supabase/migrations/20260743000000_hide_univ_number.sql:48-53](supabase/migrations/20260743000000_hide_univ_number.sql#L48-L53), [supabase/migrations/20260743000000_hide_univ_number.sql:84-93](supabase/migrations/20260743000000_hide_univ_number.sql#L84-L93)
- **Risk:** helper catches and suppresses DB errors, and `isUnivNumberHidden` returns false on error. UI fallback can show unmasked data if a caller has it; direct profile SELECT policy must be considered separately.
- **Status:** masked in named public RPC outputs; UI helper is partial and error fail-open.

### Card themes and site theme — **PARTIAL / local fallback**
- **Card themes:** client thresholds: stars 0, clouds 100, moon 300, sun 700, galaxy 1500; default based on points. [src/lib/profileCardThemes.ts:17-91](src/lib/profileCardThemes.ts#L17-L91)
- **Persistence:** ProfileCardFrame writes `profiles.theme` (via `as any`) and additionally writes localStorage `unihub_profile_themes_v1`. Route reads DB theme if available, then localStorage fallback. [src/components/ProfileCardFrame.tsx:88-120](src/components/ProfileCardFrame.tsx#L88-L120), [src/routes/_authenticated/profile.$id.tsx:55-79](src/routes/_authenticated/profile.$id.tsx#L55-L79)
- **Schema discrepancy:** live `profiles` has `theme` and `card_theme_id`, but no `has_used_direct_name_change`; generated types include `theme`, `card_theme_id`. Direct type escape for theme is unnecessary in current generated schema. [src/integrations/supabase/types.ts:629-687](src/integrations/supabase/types.ts#L629-L687)
- **Enforcement:** theme unlock thresholds are client UI checks only; no DB/RLS enforcement found, so callers can directly write arbitrary `theme` if profile self-update policy allows. `card_theme_id` is a separate schema column and not the field used by this card UI.
- **Site theme:** `ThemeToggle` calls `useTheme`; root initializes from `localStorage.getItem("theme")` and OS preference; no profile/site-theme column persistence demonstrated. [src/components/ThemeToggle.tsx:1-18](src/components/ThemeToggle.tsx#L1-L18), [src/routes/__root.tsx:162-168](src/routes/__root.tsx#L162-L168)
- **Status:** card theme DB + local copy; site theme browser-local only, not synced across devices.

### Verified badge — **PARTIAL, enforced admin-only at DB but auto-award logic present**
- **Display:** VerifiedBadge is presentation-only; ProfileCardFrame renders it when `profile.verified` truthy. [src/components/VerifiedBadge.tsx:4-23](src/components/VerifiedBadge.tsx#L4-L23), [src/components/ProfileCardFrame.tsx:391](src/components/ProfileCardFrame.tsx#L391)
- **DB:** `verified` defaults false; protected profile update trigger prevents non-admin changes; `admin_set_verified(_user uuid, _verified boolean)` checks admin role and records `admin_actions`. [supabase/migrations/20260722000000_verified_badge_and_column_protection.sql:37-58](supabase/migrations/20260722000000_verified_badge_and_column_protection.sql#L37-L58)
- **Contradiction:** an earlier migration auto-flips verified to true when points reach 1000, despite later migration comments/design saying admin-only verification. [supabase/migrations/20260721000326_6aa8a8d8-645d-43e9-9cbb-d10b42bade98.sql:9-21](supabase/migrations/20260721000326_6aa8a8d8-645d-43e9-9cbb-d10b42bade98.sql#L9-L21). The later protection trigger can reset verified changes unless admin; exact trigger ordering/active DB trigger state not inspected.
- **Status:** admin RPC enforcement exists by migration; badge rendering works from boolean. Meaning of “verified” is contradictory (automatically points threshold vs manual admin approval).

### Points/ranks — **PARTIAL (presentation thresholds only)**
- **Thresholds:** bronze 0, silver 100, gold 300, platinum 700, diamond 1500 in `ranks.ts`, `computeRank`, card themes and progress component. [src/lib/ranks.ts:3-35](src/lib/ranks.ts#L3-L35), [src/hooks/useAuth.tsx:43-49](src/hooks/useAuth.tsx#L43-L49), [src/components/UserRankProgressCard.tsx:31-61](src/components/UserRankProgressCard.tsx#L31-L61)
- **DB authority:** points are a DB profile column; protected trigger blocks self-edit and migration fixes award-points implementation. Client rank UI derives from points; no independent DB rank column/RPC used in these components. [supabase/migrations/20260722000000_verified_badge_and_column_protection.sql:17-35](supabase/migrations/20260722000000_verified_badge_and_column_protection.sql#L17-L35)
- **Status:** rank calculation/display confirmed in code; actual awarding behavior/runtime not verified.

### Android deep-link contract — **PARTIAL / web-side only**
- `validateMobileRedirect` accepts exactly `com.nexus.app://login-callback` (custom scheme, hostname `login-callback`, no path/query/hash); stores validated redirect in `sessionStorage` under `nexus_mobile_auth_redirect`. [src/lib/mobileAuthBridge.ts:3-37](src/lib/mobileAuthBridge.ts#L3-L37)
- After auth/profile completion, `buildMobileSessionLink` returns callback plus URL fragment parameters `access_token`, `refresh_token`, `expires_in`, `token_type`; redirect cleared after successful complete-profile callback. [src/lib/mobileAuthBridge.ts:39-48](src/lib/mobileAuthBridge.ts#L39-L48), [src/routes/_authenticated/complete-profile.tsx:98-110](src/routes/_authenticated/complete-profile.tsx#L98-L110)
- Google OAuth and password login both ultimately use auth completion function; web sends the session link to window location. [src/routes/auth.tsx:62-85](src/routes/auth.tsx#L62-L85)
- **Status:** web contract confirmed, Android intent-filter/consumer implementation not in reviewed scope; no evidence of token parsing or secure consumption on Android. Session tokens are placed in the fragment by design.

## Cross-cutting errors, empty states, security contradictions
- AuthProvider catches profile/role fetch errors silently; missing profile triggers client upsert with random placeholder university number, but upsert result can remain null. [src/hooks/useAuth.tsx:93-121](src/hooks/useAuth.tsx#L93-L121), [src/hooks/useAuth.tsx:148-150](src/hooks/useAuth.tsx#L148-L150)
- Authenticated router guard checks session only and has a 2-second cooldown that can skip a subsequent session check; it does not enforce profile completion or password change. [src/routes/_authenticated/route.tsx:13-45](src/routes/_authenticated/route.tsx#L13-L45)
- LocalStorage-only states: site theme `theme`; fallback selected profile themes `unihub_profile_themes_v1`. These are not cross-device sources of truth. [src/routes/__root.tsx:162-168](src/routes/__root.tsx#L162-L168), [src/components/ProfileCardFrame.tsx:114-120](src/components/ProfileCardFrame.tsx#L114-L120)
- **Frontend calls to missing live schema:** `name_change_requests` table and `profiles.has_used_direct_name_change` column are absent in current connected DB despite migration source; helper suppresses errors. `profiles.theme` is present live; card writes that column. `get_public_profiles` and `admin_set_verified` appear defined in migrations/types, but live function catalog was not queried.
- **RLS/storage:** profile self-update is broad row-level permission in initial migration; later trigger protects privileged columns, but does not establish field-by-field restrictions for ordinary fields such as university number/name/theme. Avatar read policy is broad authenticated-user read, not owner-private. The code should not claim private avatars or treat frontend gates as authoritative.

## Overall status matrix
| Feature | Status |
|---|---|
| University-number login | PARTIAL (synthetic email mismatch with self-signup path) |
| Signup | PARTIAL (user-chosen first password; device check disabled) |
| `must_change_password` | BROKEN enforcement/clearance |
| Google OAuth | PARTIAL, provider configuration unverified |
| Profile completion | PARTIAL |
| Password reset | PARTIAL; real recovery link/session, no manual OTP |
| Profile view/edit | PARTIAL |
| Avatar upload/private bucket | PARTIAL; private-read claim contradicted |
| Name-change requests | BROKEN against live DB |
| Hide university number | PARTIAL (public RPC masking; UI fail-open) |
| Card themes | PARTIAL; client unlocks + local fallback |
| Site theme | UI/localStorage-only |
| Verification badge | PARTIAL; DB admin protection plus automatic-threshold contradiction |
| Points/ranks | PARTIAL; frontend display thresholds |
| Android deep link | PARTIAL; web contract only |

---

# Posts & Social audit

Scope evidence: inspected the named route/components and current PostgreSQL `pg_policies` for posts, comments, post_reactions, saved_posts and post_reports. Statuses describe observed implementation, not a successful live end-to-end test.

## Feed and post types — PARTIAL
- **Route/component/user flow:** `/_authenticated/feed` renders CreatePost and PostList with all/open/solved question tabs (`src/routes/_authenticated/feed.tsx:15-17,34-46`). PostList fetches newest 50 posts and filters questions on `post_type` plus `accepted_answer_id` (`src/components/PostList.tsx:27-42`). Empty list has a message; loading has a spinner (`src/components/PostList.tsx:99-110`).
- **Persistence:** selected columns are `id, content, images, author_id, is_anonymous, created_at, post_type, accepted_answer_id`; reactions use post_id/user_id/reaction and comments post_id (`src/components/PostList.tsx:27-34,53-58`). CreatePost invokes `create_post_as(_content,_images,_post_type,_anonymous)` (`src/components/CreatePost.tsx:101-113`). Client represents general vs question; database function definition was not found in migrations, so actual RPC existence/semantics are **UNVERIFIED**.
- **Permissions:** feed route is under authenticated routes; posts SELECT policy is authenticated `USING true`; insert policy checks `auth.uid() = author_id` (`src/routes/_authenticated/feed.tsx:15-17`; DB `pg_policies` output). RPC-mediated anonymous insert compatibility cannot be confirmed from policy listing alone.

## Comments, accepted answer, anonymous identities, mentions — PARTIAL
- Detail route reads post and comments, subscribes to comments realtime filtered by `post_id`, and groups replies by `parent_id` (`src/routes/_authenticated/posts.$id.tsx:71-97,125,235-236`). Comment mutation calls `create_comment_as` with parent parameter `_parent_id` (`src/routes/_authenticated/posts.$id.tsx:145-150`). The function definition was not found in migrations; not confirmed available.
- Post author can mark one response accepted by updating `posts.accepted_answer_id`; question-only and author eligibility are client conditions (`src/routes/_authenticated/posts.$id.tsx:203-204,509-510`). RLS update policy allows own-author or anonymous owner, but UI-only check does not prove DB enforcement that only post author changes accepted_answer_id (policy output).
- Suspension is checked in post/comment submit handlers (`src/components/CreatePost.tsx:101-105`; `src/routes/_authenticated/posts.$id.tsx:143-150`), i.e. visible client enforcement; policies shown do not encode suspension. Anonymous authors lookup/reveal and exact storage implementation were not fully confirmed; don't treat `anonymous_authors` as an enforced privacy barrier absent RPC/function inspection.
- Comment reactions are explicitly localStorage-only under `cmt_reactions_${commentId}` (`src/routes/_authenticated/posts.$id.tsx:407-427`), not durable DB reactions. Mentions notification behavior is unverified; no reliable database-backed mention implementation established from inspected evidence.
- Comments RLS: authenticated SELECT all; INSERT self author_id; UPDATE/DELETE own or admin/anonymous-owner. See live `pg_policies` query result. No DB suspension check apparent in these policies.

## Reactions, save, share, report, edit/delete — PARTIAL
- Post reactions persist via `post_reactions` with `post_id,user_id,reaction`; UI mutation inserts/deletes and computes counts from rows (`src/components/PostCard.tsx:124-133,222-224`). Reaction options are imported as `REACTIONS` (`src/components/PostCard.tsx:35`); complete five-reaction mapping not independently confirmed. RLS permits authenticated users to manage only their own rows and read all (`pg_policies`).
- Saves insert/delete `saved_posts(post_id,user_id)`; list fetches saved post IDs (`src/components/PostCard.tsx:187-194`; `src/components/PostList.tsx:18-24`). `saved_posts` ALL policy restricts user_id to auth.uid() (`pg_policies`).
- Share invokes native `navigator.share` when available (`src/components/PostCard.tsx:226-229`); browser fallback/error behavior needs full component verification.
- Delete invokes posts DELETE (`src/components/PostCard.tsx:106-116`; detail `src/routes/_authenticated/posts.$id.tsx:58-68`); posts policy allows own author, admin, or anonymous owner. Report storage uses `post_reports` policy set: own reporter insert, own/admin read, admin update/delete (`pg_policies`); UI report submission details not conclusively verified. Editing post/comment behavior was not established as complete.

## Images and banned words — PARTIAL
- Upload uses bucket `post-images`, owner folder and max four images / 5 MB client checks; `uploadFile` returns paths and RPC gets `_images` (`src/components/CreatePost.tsx:78-98,107-112`). UI reads post `images` (`src/components/PostList.tsx:27-34`; `src/components/PostCard.tsx:61,334-338`). A migration adds `posts.image_paths` (`supabase/migrations/20260719001541_3e5afc9f-636a-4b44-b3f3-b5cef1ad491d.sql:8`), creating an apparent schema naming mismatch: current feed uses `images`, while migration adds `image_paths`. Storage policies allow authenticated reads and owner-folder writes/deletes (admin also delete) (`supabase/migrations/20260719001541_3e5afc9f-636a-4b44-b3f3-b5cef1ad491d.sql:70-74`). Exact StorageImage URL/render behavior needs confirmation.
- Banned words are fetched from `banned_words.word` and substring matched in the browser; submission blocks on matches (`src/components/CreatePost.tsx:23-26,67-76,101-105`). Thus filtering is client-only in evidence; DB enforcement not established. Missing list/query errors are ignored (`src/components/CreatePost.tsx:70-73`), so a fetch failure can leave the check empty.

## Search — UNVERIFIED / PARTIAL
- `GlobalSearchDialog` and leaderboard refer to profile search (`src/routes/_authenticated/leaderboard.tsx:195-197,215-216`), but the requested dialog's complete query implementation was not established from captured lines. Do not claim universal post/comment search: no confirmed search query over posts/comments in this evidence. Leaderboard fallback `search_public_profiles(_q)` only gathers profile IDs (`src/routes/_authenticated/leaderboard.tsx:195-216`).

## Leaderboard, filters, points — PARTIAL
- Leaderboard uses major/year filters and calls `get_leaderboard_profiles` with `_major` and `_year`; course selection can set effective major/year (`src/routes/_authenticated/leaderboard.tsx:75-76,118-125,151-156`). Migration defines a public-profile RPC (`supabase/migrations/20260724000001_leaderboard_public_profiles_rpc.sql:17-31`); fallback queries profiles and excludes banned users, with additional role filtering (`src/routes/_authenticated/leaderboard.tsx:174-181,249-256`). UI displays empty state (`src/routes/_authenticated/leaderboard.tsx:759`).
- Potential discrepancy: frontend RPC passes `_major` and `_year` (`src/routes/_authenticated/leaderboard.tsx:152-156`); migration signature/definition must be checked directly before concluding params match. Existing migration excerpt indicates output profile fields and points ordering, but not enough here to confirm filters.
- Points display says post +5, comment +2, interaction on own post +1, confirmed report -20 (`src/routes/_authenticated/feed.tsx:103-105`). Migration triggers award +5 on posts, +2 on comments, and +1 to post author for another user's reaction (`supabase/migrations/20260717122157_10b40ca7-c9f5-456c-88b3-7d7cdf968d9a.sql:32-53`). Report penalty trigger was not confirmed. Rank thresholds differ: UI ranks are defined in `src/lib/ranks.ts` (referenced by feed at `src/routes/_authenticated/feed.tsx:12,30-32`), while SQL compute_rank migration thresholds are 50/150/400/1000 (`supabase/migrations/20260717122157_10b40ca7-c9f5-456c-88b3-7d7cdf968d9a.sql:14-20`); check for consistency.

## RLS result summary
Live policies: posts SELECT authenticated all; insert self author; update own/anonymous owner; delete own/admin/anonymous owner. Comments similarly select all, insert self, update/delete own/admin/anonymous owner. post_reactions SELECT all authenticated and ALL own `user_id`. saved_posts ALL own `user_id`. post_reports INSERT own `reporter_id`, SELECT own/admin, UPDATE/DELETE admin. These controls are database-enforced as shown by `pg_policies`; no listed policy enforces suspension or banned-word checks.

## Overall limitations / risk flags
- **UI-only enforcement:** suspended and banned-word checks are in client flows; the inspected RLS policies do not enforce them.
- **Local-only behavior:** comment reactions stored in localStorage, not server-backed (`src/routes/_authenticated/posts.$id.tsx:407-427`).
- **Schema/API uncertainty:** frontend calls `create_post_as` and `create_comment_as`; their definitions were not found in `supabase/migrations` search. `images` frontend field vs `image_paths` migration addition deserves schema reconciliation.
- **UNVERIFIED:** mention notifications, anonymous reveal safeguards, exact report workflow, editing, search coverage, complete reaction set and empty/error handling for several secondary components. Component presence alone is not proof of complete backend behavior.

---

# Messaging & Notifications Audit

## Scope and evidence limits
Audited the requested source files and migration SQL; queried live `information_schema.routine_privileges` and `pg_policies`. The migration tree does not contain definitions for five client-called conversation RPCs; their bodies could not be validated from checked-in SQL. Live grants show `PUBLIC EXECUTE` (see below), but that does not establish deployed function bodies. Statuses distinguish evidence from inferred operation.

## Messaging

### Conversation routes / DMs and groups — PARTIAL
- **Route/components:** `/messages` (`src/routes/_authenticated/messages.tsx`) and `/messages/$id` (`src/routes/_authenticated/messages.$id.tsx`); `MessagesShell`, `NewConversationDialog`, `chatUtils`.
- **Flow:** `chatUtils` calls `create_dm(_other)` then has a table-based fallback; group creation dialog calls `create_group(_name, _members)`. SQL implementations are in `supabase/migrations/20260717122157_10b40ca7-c9f5-456c-88b3-7d7cdf968d9a.sql:125-160`. `create_dm` derives self from `auth.uid()`, rejects unauthenticated/self, reuses matching DM, otherwise creates conversation+members. `create_group` derives creator from auth.uid and inserts creator and supplied UUID members; it does not validate membership eligibility in shown body.
- **Schema/data:** `conversations(id,is_group,name,created_by,created_at,updated_at)`, `conversation_members(conversation_id,user_id,joined_at)`, `messages(id,conversation_id,sender_id,content,created_at)` (`supabase/migrations/20260716015956_4522f137-222f-4cdb-8429-68cf30514785.sql:124-177`). No attachment columns in this schema.
- **Permissions:** Authenticated RLS restricts conversation select to members/admin; messages select/insert to members and sender; see migration `:215-230` and live `pg_policies` output. Member INSERT policy also permits an existing member to add any `user_id`; this is broader than creator-only comment in SQL. Group/Dm RPCs are SECURITY DEFINER and derive caller auth identity (migration `20260717122157...sql:125-160`).
- **Status note:** exact UI route behavior and fallback are in `src/lib/chatUtils.ts:12-73`; group invocation in `src/components/NewConversationDialog.tsx:67`. Since no end-to-end test/runtime validation was performed, overall PARTIAL.

### Conversation messages, realtime, read receipts — PARTIAL
- **Flow:** conversation detail fetches membership/messages and subscribes to realtime channel `conv-${id}`; source `src/routes/_authenticated/messages.$id.tsx:146-211`. Code listens to message activity (refer to that range for subscribed table/event). Sending inserts `messages` with `conversation_id`, `sender_id`, `content`; see `:274-286`.
- **Read/unread:** detail calls `mark_conversation_read({_conv_id:id,_user_id:user.id})` at `:211`; shell fetches `get_conversation_unread_counts({_user_id:user.id})` at `src/components/MessagesShell.tsx:72`; AppLayout requests `get_unread_message_count({_user_id:profile.id})` at `src/components/AppLayout.tsx:68`.
- **Database security:** live privileges show all five named RPCs (`mark_conversation_read`, `leave_conversation`, `delete_conversation`, `get_unread_message_count`, `get_conversation_unread_counts`) granted EXECUTE to `PUBLIC`. Thus they are callable by anon at SQL privilege level unless function-body auth checks reject it. Their definitions were not present in checked-in migrations/search results, so client-supplied `_user_id` enforcement cannot be verified. **Security concern: UNVERIFIED / high risk**, especially because caller passes arbitrary user IDs. RLS protects direct table access but does not constrain a SECURITY DEFINER RPC's internal SQL.
- **Typing/receipts:** no evidence of typing event or per-message receipt fields in the messages schema (only `content`, sender, timestamps); `conversation_members` has no read marker in initial schema. Feature therefore UNVERIFIED/not evidenced.
- **Attachments:** no attachment column in checked-in message table; no message attachment storage path evidenced in audited detail flow. Not evidenced/UNVERIFIED.

### Leave/delete and block/report — PARTIAL
- **Leave/delete:** shell calls `leave_conversation` / `delete_conversation` (`src/components/MessagesShell.tsx:82-97`); detail also exposes leave at `src/routes/_authenticated/messages.$id.tsx:232`. RPC bodies unavailable in migration tree; live EXECUTE is PUBLIC. Direct member DELETE policy lets a user remove own membership/admin only; conversation DELETE is creator/admin only (live policies). RPC authorization and intended delete semantics UNVERIFIED.
- **Block:** detail queries/inserts/deletes `blocked_users` (`messages.$id.tsx:88-119`). Table policies enforce `blocker_id=auth.uid()` for insert and own/admin read/delete (migration `supabase/migrations/20260728000000_message_block_and_report.sql:7-22`; live policies agree). Migration includes a trigger/function to prevent messaging across a block (`:49-`); block is enforced server-side for message insertion, not merely UI. Confirm exact trigger behavior from that migration.
- **Report:** detail inserts `message_reports` (`messages.$id.tsx:249`). Table columns/policies in migration `20260728000000_message_block_and_report.sql:25-44`; insert policy requires `reporter_id=auth.uid()`, select own/admin, update admin. Status PARTIAL: database safeguards exist; UI flow not runtime-tested.
- **Suspension:** detail derives `suspended=isSuspended(profile)` and explicitly throws before sending (`messages.$id.tsx:83,274`). This is UI-side evidence only. Message INSERT RLS checks sender identity and membership, not suspension (`20260716015956...sql:228-230`); no DB enforcement identified. **Security contradiction: suspended users may bypass UI and insert directly if otherwise authorized.** Status UI-ONLY.

## Notifications

### Notification inbox and synthetic activity — PARTIAL
- **Component/flow:** `NotificationsPopover` fetches/updates the store and subscribes to INSERT on `public.notifications` (`src/components/NotificationsPopover.tsx:96-101`); unread count derives from `!read` (`:147`).
- **Persisted rows:** `notificationsStore.createNotification` inserts fields `recipient_id,actor_id,actor_name,actor_avatar,type,priority,title,body,link` (`src/lib/notificationsStore.ts:14-39`). `broadcastNotification` bulk-inserts equivalent rows (`:51-84`). No trigger-created event pipeline was found in checked migrations; client inserts are explicit. `fetchRealtimeNotifications` reads DB rows and synthesizes comment/reaction/message/warning notifications from `comments`, `post_reactions`, `messages`, `user_warnings` (`:128-324`). Synthetic IDs use `comment_`, `react_`, `msg_`, `warn_`; synthetic read/hidden state is stored in per-user localStorage keys `nexus_notif_read_${userId}` / `nexus_notif_hidden_${userId}` (`:96-125`). These are device/browser-local, not durable cross-device.
- **Events:** messages are synthesized from up to 20 recent incoming messages, comments/reactions from activity on own posts, warnings from `user_warnings`; not DB notification rows (`notificationsStore.ts:137-315`). DB notifications take precedence in dedupe (`:316-324`).
- **Permissions:** live `notifications` policies: users SELECT own recipient rows, UPDATE/DELETE own; INSERT includes admin/subadmin policy plus authenticated “genuine” insertion requiring `actor_id=auth.uid()`, non-announcement type, allowed priority. Admin/subadmin can insert announcements. Broadcast inserts from client are therefore constrained by RLS, despite component's admin UI; validate `actor_id` and user role. Live `pg_policies` output provides exact predicates.
- **Priority:** The store accepts priority values `urgent|important|normal`, while the database policy permits `low|normal|medium|high|important|urgent`; the component defaults normal.

## Notifications (continued)
- **Priority/broadcast targeting:** Store accepts `urgent|important|normal`, defaults normal (`notificationsStore.ts:4,32,61`). Broadcast UI targets selected IDs/all-user list and calls `broadcastNotification` (`src/components/BroadcastNotificationTab.tsx:174-225`); this is client fan-out into one row per recipient, not a server-side broadcast RPC. RLS permits announcement insert only admin/subadmin per live policy; targeted recipient selection does not itself enforce role.
- **Read/clear/error behavior:** DB actions update/delete own rows; synthetic state is localStorage. Fetch tolerates absent/error data by continuing with empty result in several queries; inbox empty state is based on no items (`notificationsStore.ts:128-324`; `NotificationsPopover.tsx:282-328`).
- **Push:** `pushNotifications.ts` uses browser `Notification` permission and `registration.showNotification` / `new Notification` (`:5-11,17-40,46-81`). No push subscription registration, endpoint persistence, VAPID key, or server delivery evidenced. This is local device notification dispatch when code runs, not true web push to offline devices. Status UI-ONLY/local.

## AppLayout unread counter
`AppLayout` clears PWA local preference and fetches `get_unread_message_count` for profile ID (`src/components/AppLayout.tsx:54,68`). Count accuracy and caller authorization depend on unavailable function body; live grant is PUBLIC EXECUTE. Status UNVERIFIED.

## DB security snapshot (live)
- RPC privileges: `PUBLIC EXECUTE` on `create_dm`, `create_group`, `delete_conversation`, `get_conversation_unread_counts`, `get_unread_message_count`, `leave_conversation`, `mark_conversation_read` (queried via `information_schema.routine_privileges`). Public grant on create RPCs is mitigated in their checked-in bodies by `auth.uid()` null checks; no such conclusion can be made for the other five.
- `conversations`: member/admin SELECT, creator/admin update/delete, created_by self insert.
- `conversation_members`: member/admin SELECT, self/member/admin INSERT, self/admin DELETE.
- `messages`: member SELECT, sender+member INSERT, sender/admin DELETE.
- `message_reports`: own/admin SELECT, reporter=self INSERT, admin UPDATE.
- `blocked_users`: blocker=self INSERT and own/admin SELECT/DELETE.
- `notifications`: recipient=self SELECT/UPDATE/DELETE; authenticated genuine insert requires actor=self, type not announcement, priority in low/normal/medium/high/important/urgent; admin/subadmin announcement insert.

## Findings requiring attention
1. **Critical authorization uncertainty:** five chat RPC definitions are absent from checked-in SQL but live EXECUTE is PUBLIC; client passes `_user_id`. Verify bodies in deployed DB and revoke PUBLIC, grant only authenticated, and derive/check `auth.uid()` inside each RPC.
2. **Suspension enforcement is client-only** in the inspected path; message RLS permits any authenticated member sender.
3. **Broadcast depends on client fan-out and RLS:** all/targeted targeting does not confer authorization; database role policy is the actual gate.
4. **Synthetic notifications are localStorage-only** for read/dismiss state and do not synchronize between devices.
5. **No true web push delivery** was evidenced; only in-browser/foreground `showNotification`.
6. No attachment schema/use evidenced; typing and message receipt functionality not evidenced.

---

# COURSES audit

## Scope and evidence
Reviewed course routes/components/utilities and queried live `pg_policies` as requested. Database policy query returned overlapping permissive policies (Postgres ORs applicable permissive policies); it does not produce one clean final rule. Thus preserve and report the live result rather than infer intended migration state. `get_courses_with_counts` search returned no match in repository (unverified whether external DB function exists).

## Directory and filters — PARTIAL
- **Route/component:** `/courses` index (`src/routes/_authenticated/courses.index.tsx`); routes use authenticated layout (`courses.tsx`).
- **Flow:** query `courses` ordered by `year`,`semester`, filters `major`, numeric `year`, `semester`; major defaults from profile; latest materials query `course_links` and embedded `courses`; teacher/author names fetched via `get_public_profiles({_ids})`. Major choices are `it/is/se`, years 1–4, semesters 1–2 (`src/lib/college.ts:1-8`; `courses.index.tsx:89-102,128-148,177-195`).
- **Permissions:** authenticated users can read all courses according to live `courses_select_all` policy (`true`). Admin/sub-admin `can_courses` create UI is gated in index (`courses.index.tsx:270-273`), but this is not equivalent to DB enforcement; see permission conflict below.
- **States:** query errors are thrown in listing query; cards/loading and empty presentation exist, but no per-query explicit error panel identified (`courses.index.tsx:128-139`).
- **Counts:** no use/definition of `get_courses_with_counts` located in repository; UNVERIFIED.

## My courses — PARTIAL
- **Route:** `/courses/mine`, `src/routes/_authenticated/courses.mine.tsx:12-14`.
- **Flow:** only admin/teacher UI access; teachers filter `courses.teacher_id = user.id`; admins retrieve all courses, then search and group by major/year (`:25-48,60-70`).
- **Permission:** front-end redirect only for non-admin/non-teacher (`:30-34`); RLS read policy is broad authenticated SELECT. Query ignores errors (`:46-48`). Empty state exists (`:104-114`). Note it omits courses where a teacher is only `created_by`, unlike index's assigned-course calculation.
- **Status:** PARTIAL; UI access is restricted but underlying courses are readable to authenticated users.

## Course detail and management — PARTIAL / security mismatch
- **Routes:** `/courses/$id` and `/courses/$id/manage` (`courses.$id.tsx:...`; `courses.$id.manage.tsx:45-47`). Detail reads course row and teacher profile; management loads the row and permits UI when main admin, sub-admin with `can_courses`, `created_by`, or `teacher_id` matches (`courses.$id.manage.tsx:56-65`).
- **Course fields:** updates save `name`, `description`, `major`, `year`, `semester`; only main admin sets `teacher_id` (`courses.$id.manage.tsx:100-111`). Delete is offered through route/dialog (`:120-131`).
- **UI versus RLS:** live policies include broad `courses_update_own_or_staff` allowing any teacher to update any course, and broad `courses_delete_own_or_staff` allowing any teacher to delete any course. `courses_update_own_or_admin` additionally scopes teacher to `teacher_id`/creator; duplicate permissive policy defeats that intended restriction. Delete policies likewise include both an ownership/admin rule and broad teacher rule. Insert policies permit admin, sub_admin, and teacher; neither live policies nor the inspected UI prove sub-admin `can_courses` is enforced in DB. DB deletion also permits creator; UI detail delete condition needs inspection in context. Students have no insert/update/delete privilege via these course policies.
- **Status:** PARTIAL with critical permissive-policy contradictions. UI scoping is not reliable security enforcement.

## Course tabs / materials
- **Links:** `course_links` records; live SELECT is authenticated `true`. Live INSERT includes teacher/admin and a separate staff/owner scoped policy; because permissive policies combine, broad teacher insert permits any teacher. UPDATE/DELETE similarly have broad teacher policies alongside owner/admin rules. UI is implemented by `LinksTab` (route imports at `courses.$id.manage.tsx:38-42`).
- **Files:** `FilesTab` uses `course-files` storage bucket; live read policies permit authenticated reads (`coursefiles_read`, `coursefiles_read_authenticated`). Upload/delete policies include broad teacher/admin plus scoped staff variants; broad policies allow a teacher to upload/delete irrespective of course ownership. Files are accessed via signed URLs per implementation; sharing signed URL is bearer access until expiration. Student read is allowed, write is not by storage policy. Exact storage policy query output is live, but the full scoped policy expression was truncated by psql output; re-query needed for its full folder-name predicate.
- **Important flag:** migration names indicate material pinning/important flag (`20260724000002...`, `20260724000003...`); no confident live schema claim without targeted column inspection. `course_links` live RLS results confirmed above.
- **Schedule:** schedule is read from `course.schedule` and treated as JSON array `ScheduleEntry[]`; UI state initializes to `course.schedule ?? []` (`ScheduleTab.tsx:14-29`), route casts DB schedule to that type (`courses.$id.tsx:239` and manage route `:324-328`). Exact entry shape must be confirmed in `src/components/courses/course-types.ts`; do not assume DB validation.
- **Updates:** course updates read/write `course_updates`; live fields/policies evidence: `author_id`; insert requires `auth.uid() = author_id` and role teacher/admin; select is authenticated `true`; delete/update author or admin. Image path field `image_paths` should be confirmed from component/migration; this report does not assert storage relation for images.
- **Discussions:** not merely a static UI: `DiscussionsTab` queries `posts`, gets public profiles via `get_public_profiles({_ids})`, invokes `create_post_as` with params visible in the component, and deletes from `posts` (`DiscussionsTab.tsx:34-46,66-86`). It is a course-filtered posts UI, not evidence of a dedicated course-discussions table. RPC existence/authorization needs DB confirmation.

## Database policy snapshot (live)
- Query returned 19 policies across `courses`, `course_links`, `course_updates`. Important overlapping course policies: `courses_insert_admin`, `courses_insert_admin_or_subadmin`, `courses_insert_teacher_admin`; `courses_delete_admin`, `courses_delete_own_or_staff`; `courses_update_own_or_admin`, `courses_update_own_or_staff`. All authenticated roles. Since permissive policies OR together, the broad staff rules materially widen access.
- `course_links`: overlapping `course_links_insert` (teacher/admin) and `course_links_insert_staff` (admin or linked course teacher/creator); likewise broad teacher update/delete alongside owner/admin policies.
- `course_updates`: authenticated SELECT true; insert teacher/admin only with `author_id=auth.uid()`; delete/update author or admin.
- Storage snapshot includes unrestricted authenticated `course-files` reads, and both broad teacher/admin upload/delete policies and staff-scoped variants. This conflicts with any claim that course materials are private or teacher-scoped.

## Utilities and persistence
- `college.ts` defines majors, years, semesters as above (`src/lib/college.ts:1-8`). `courseMaterialKind.ts` classifies file extensions and links, purely presentation helpers (`:22-76`). No claim of server-side validation.
- `courseUtils.ts`, `storage.ts`, and `exportCsv.ts` are in requested scope; exact behavior should be checked by their individual line references before relying on export/storage assumptions. No localStorage-backed course feature was established in evidence reviewed; do not describe persistence as local-only.

## Required follow-up / limitation
The audit cannot certify “confirmed working” solely from component presence. Re-run the storage policy query without truncation and inspect `course-types.ts`, complete `FilesTab`, `UpdatesTab`, `LinksTab`, and current migrations/schema for exact columns and RPC signatures. The live policy state already demonstrates a significant UI/DB mismatch: UI course ownership and sub-admin `can_courses` checks do not constrain broad teacher policies, and storage permits authenticated reads.

---

# Admin, pinned cards, and full live DB contract

Read-only catalog audit; no mutations or RPCs executed. Runtime user sessions were not exercised. SQL evidence below is numbered in this artifact for file:line citations.

## Appendix: Public columns

Query: `SELECT table_name,column_name,ordinal_position,data_type,udt_schema,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`

```csv
table_name,column_name,ordinal_position,data_type,udt_schema,udt_name,is_nullable,column_default
admin_actions,id,1,uuid,pg_catalog,uuid,NO,gen_random_uuid()
admin_actions,admin_id,2,uuid,pg_catalog,uuid,NO,
admin_actions,target_user_id,3,uuid,pg_catalog,uuid,YES,
admin_actions,action,4,text,pg_catalog,text,NO,
admin_actions,details,5,jsonb,pg_catalog,jsonb,YES,
admin_actions,created_at,6,timestamp with time zone,pg_catalog,timestamptz,NO,now()
anonymous_authors,content_type,1,text,pg_catalog,text,NO,
anonymous_authors,content_id,2,uuid,pg_catalog,uuid,NO,
anonymous_authors,author_id,3,uuid,pg_catalog,uuid,NO,
anonymous_authors,created_at,4,timestamp with time zone,pg_catalog,timestamptz,NO,now()
banned_words,id,1,uuid,pg_catalog,uuid,NO,gen_random_uuid()
banned_words,word,2,text,pg_catalog,text,NO,
banned_words,created_at,3,timestamp with time zone,pg_catalog,timestamptz,NO,now()
blocked_users,blocker_id,1,uuid,pg_catalog,uuid,NO,
blocked_users,blocked_id,2,uuid,pg_catalog,uuid,NO,
blocked_users,created_at,3,timestamp with time zone,pg_catalog,timestamptz,NO,now()
comments,id,1,uuid,pg_catalog,uuid,NO,gen_random_uuid()
comments,post_id,2,uuid,pg_catalog,uuid,NO,
comments,parent_id,3,uuid,pg_catalog,uuid,YES,
comments,author_id,4,uuid,pg_catalog,uuid,YES,
comments,content,5,text,pg_catalog,text,NO,
comments,created_at,6,timestamp with time zone,pg_catalog,timestamptz,NO,now()
comments,is_anonymous,7,boolean,pg_catalog,bool,NO,false
conversation_members,conversation_id,1,uuid,pg_catalog,uuid,NO,
conversation_members,user_id,2,uuid,pg_catalog,uuid,NO,
conversation_members,joined_at,3,timestamp with time zone,pg_catalog,timestamptz,NO,now()
conversation_members,last_read_at,4,timestamp with time zone,pg_catalog,timestamptz,YES,now()
conversations,id,1,uuid,pg_catalog,uuid,NO,gen_random_uuid()
conversations,is_group,2,boolean,pg_catalog,bool,NO,false
conversations,name,3,text,pg_catalog,text,YES,
conversations,created_by,4,uuid,pg_catalog,uuid,YES,
conversations,created_at,5,timestamp with time zone,pg_catalog,timestamptz,NO,now()
conversations,updated_at,6,timestamp with time zone,pg_catalog,timestamptz,NO,now()
course_links,id,1,uuid,pg_catalog,uuid,NO,gen_random_uuid()
course_links,course_id,2,uuid,pg_catalog,uuid,NO,
course_links,title,3,text,pg_catalog,text,NO,
course_links,url,4,text,pg_catalog,text,NO,
course_links,link_type,5,text,pg_catalog,text,YES,
course_links,created_by,6,uuid,pg_catalog,uuid,YES,
course_links,created_at,7,timestamp with time zone,pg_catalog,timestamptz,NO,now()
course_links,is_important,8,boolean,pg_catalog,bool,NO,false
course_updates,id,1,uuid,pg_catalog,uuid,NO,gen_random_uuid()
course_updates,course_id,2,uuid,pg_catalog,uuid,NO,
course_updates,author_id,3,uuid,pg_catalog,uuid,NO,
course_updates,content,4,text,pg_catalog,text,NO,
course_updates,image_paths,5,ARRAY,pg_catalog,_text,NO,'{}'::text[]
course_updates,created_at,6,timestamp with time zone,pg_catalog,timestamptz,NO,now()
courses,id,1,uuid,pg_catalog,uuid,NO,gen_random_uuid()
courses,major,2,USER-DEFINED,public,major_code,NO,
courses,year,3,smallint,pg_catalog,int2,NO,
courses,semester,4,smallint,pg_catalog,int2,NO,
courses,name,5,text,pg_catalog,text,NO,
courses,description,6,text,pg_catalog,text,YES,
courses,teacher_id,7,uuid,pg_catalog,uuid,YES,
courses,created_by,8,uuid,pg_catalog,uuid,YES,
courses,created_at,9,timestamp with time zone,pg_catalog,timestamptz,NO,now()
courses,updated_at,10,timestamp with time zone,pg_catalog,timestamptz,NO,now()
courses,schedule,11,jsonb,pg_catalog,jsonb,YES,
message_reports,id,1,uuid,pg_catalog,uuid,NO,gen_random_uuid()
message_reports,reporter_id,2,uuid,pg_catalog,uuid,NO,
message_reports,reported_user_id,3,uuid,pg_catalog,uuid,NO,
message_reports,conversation_id,4,uuid,pg_catalog,uuid,YES,
message_reports,reason,5,text,pg_catalog,text,NO,
message_reports,note,6,text,pg_catalog,text,YES,
message_reports,status,7,USER-DEFINED,public,report_status,NO,'pending'::report_status
message_reports,created_at,8,timestamp with time zone,pg_catalog,timestamptz,NO,now()
messages,id,1,uuid,pg_catalog,uuid,NO,gen_random_uuid()
messages,conversation_id,2,uuid,pg_catalog,uuid,NO,
messages,sender_id,3,uuid,pg_catalog,uuid,NO,
messages,content,4,text,pg_catalog,text,NO,
messages,created_at,5,timestamp with time zone,pg_catalog,timestamptz,NO,now()
notifications,id,1,text,pg_catalog,text,NO,"('notif_'::text || replace((gen_random_uuid())::text, '-'::text, ''::text))"
notifications,recipient_id,2,uuid,pg_catalog,uuid,NO,
notifications,actor_id,3,uuid,pg_catalog,uuid,YES,
notifications,actor_name,4,text,pg_catalog,text,YES,
notifications,actor_avatar,5,text,pg_catalog,text,YES,
notifications,type,6,text,pg_catalog,text,NO,'announcement'::text
notifications,priority,7,text,pg_catalog,text,NO,'normal'::text
notifications,title,8,text,pg_catalog,text,NO,
notifications,body,9,text,pg_catalog,text,NO,
notifications,link,10,text,pg_catalog,text,YES,
notifications,read,11,boolean,pg_catalog,bool,NO,false
notifications,created_at,12,timestamp with time zone,pg_catalog,timestamptz,NO,now()
pinned_cards,id,1,text,pg_catalog,text,NO,
pinned_cards,enabled,2,boolean,pg_catalog,bool,NO,true
pinned_cards,type,3,text,pg_catalog,text,NO,
pinned_cards,theme,4,text,pg_catalog,text,NO,
pinned_cards,badge_text,5,text,pg_catalog,text,NO,
pinned_cards,title,6,text,pg_catalog,text,NO,
pinned_cards,description,7,text,pg_catalog,text,NO,
pinned_cards,image_url,8,text,pg_catalog,text,YES,
pinned_cards,end_date,9,text,pg_catalog,text,YES,
pinned_cards,action_button_text,10,text,pg_catalog,text,YES,
pinned_cards,action_button_url,11,text,pg_catalog,text,YES,
pinned_cards,target_year,12,integer,pg_catalog,int4,YES,
pinned_cards,target_major,13,text,pg_catalog,text,YES,
pinned_cards,poll_options,14,jsonb,pg_catalog,jsonb,NO,'[]'::jsonb
pinned_cards,votes,15,jsonb,pg_catalog,jsonb,NO,'{}'::jsonb
pinned_cards,participants,16,jsonb,pg_catalog,jsonb,NO,'[]'::jsonb
pinned_cards,created_at,17,timestamp with time zone,pg_catalog,timestamptz,NO,"timezone('utc'::text, now())"
pinned_cards,updated_at,18,timestamp with time zone,pg_catalog,timestamptz,NO,"timezone('utc'::text, now())"
post_reactions,post_id,1,uuid,pg_catalog,uuid,NO,
post_reactions,user_id,2,uuid,pg_catalog,uuid,NO,
post_reactions,reaction,3,USER-DEFINED,public,reaction_type,NO,
post_reactions,created_at,4,timestamp with time zone,pg_catalog,timestamptz,NO,now()
post_reports,id,1,uuid,pg_catalog,uuid,NO,gen_random_uuid()
post_reports,post_id,2,uuid,pg_catalog,uuid,NO,
post_reports,reporter_id,3,uuid,pg_catalog,uuid,NO,
post_reports,reason,4,text,pg_catalog,text,NO,
post_reports,status,5,USER-DEFINED,public,report_status,NO,'pending'::report_status
post_reports,created_at,6,timestamp with time zone,pg_catalog,timestamptz,NO,now()
posts,id,1,uuid,pg_catalog,uuid,NO,gen_random_uuid()
posts,author_id,2,uuid,pg_catalog,uuid,YES,
posts,content,3,text,pg_catalog,text,NO,
posts,images,4,ARRAY,pg_catalog,_text,YES,
posts,created_at,5,timestamp with time zone,pg_catalog,timestamptz,NO,now()
posts,updated_at,6,timestamp with time zone,pg_catalog,timestamptz,NO,now()
posts,image_paths,7,ARRAY,pg_catalog,_text,NO,'{}'::text[]
posts,post_type,8,USER-DEFINED,public,post_type,NO,'general'::post_type
posts,accepted_answer_id,9,uuid,pg_catalog,uuid,YES,
posts,is_anonymous,10,boolean,pg_catalog,bool,NO,false
profiles,id,1,uuid,pg_catalog,uuid,NO,
profiles,university_number,2,text,pg_catalog,text,NO,
profiles,full_name,3,text,pg_catalog,text,NO,
profiles,major,4,USER-DEFINED,public,major_code,YES,
profiles,year,5,smallint,pg_catalog,int2,YES,
profiles,avatar_url,6,text,pg_catalog,text,YES,
profiles,bio,7,text,pg_catalog,text,YES,
profiles,must_change_password,8,boolean,pg_catalog,bool,NO,true
profiles,created_at,9,timestamp with time zone,pg_catalog,timestamptz,NO,now()
profiles,updated_at,10,timestamp with time zone,pg_catalog,timestamptz,NO,now()
profiles,points,11,integer,pg_catalog,int4,NO,0
profiles,email,12,text,pg_catalog,text,YES,
profiles,warning_count,13,integer,pg_catalog,int4,NO,0
profiles,suspended_until,14,timestamp with time zone,pg_catalog,timestamptz,YES,
profiles,banned,15,boolean,pg_catalog,bool,NO,false
profiles,verified,16,boolean,pg_catalog,bool,NO,false
profiles,card_theme_id,17,text,pg_catalog,text,YES,'stars'::text
profiles,hide_university_number,18,boolean,pg_catalog,bool,YES,false
profiles,theme,19,text,pg_catalog,text,YES,'stars'::text
saved_posts,user_id,1,uuid,pg_catalog,uuid,NO,
saved_posts,post_id,2,uuid,pg_catalog,uuid,NO,
saved_posts,created_at,3,timestamp with time zone,pg_catalog,timestamptz,NO,now()
subadmin_permissions,user_id,1,uuid,pg_catalog,uuid,NO,
subadmin_permissions,can_warn,2,boolean,pg_catalog,bool,NO,true
subadmin_permissions,can_suspend,3,boolean,pg_catalog,bool,NO,true
subadmin_permissions,can_courses,4,boolean,pg_catalog,bool,NO,true
subadmin_permissions,can_reports,5,boolean,pg_catalog,bool,NO,true
subadmin_permissions,can_words,6,boolean,pg_catalog,bool,NO,true
subadmin_permissions,can_teachers,7,boolean,pg_catalog,bool,NO,true
subadmin_permissions,created_at,8,timestamp with time zone,pg_catalog,timestamptz,NO,now()
user_roles,id,1,uuid,pg_catalog,uuid,NO,gen_random_uuid()
user_roles,user_id,2,uuid,pg_catalog,uuid,NO,
user_roles,role,3,USER-DEFINED,public,app_role,NO,
user_roles,created_at,4,timestamp with time zone,pg_catalog,timestamptz,NO,now()
user_warnings,id,1,uuid,pg_catalog,uuid,NO,gen_random_uuid()
user_warnings,user_id,2,uuid,pg_catalog,uuid,NO,
user_warnings,reason,3,text,pg_catalog,text,NO,
user_warnings,issued_by,4,uuid,pg_catalog,uuid,YES,
user_warnings,created_at,5,timestamp with time zone,pg_catalog,timestamptz,NO,now()
```

## Appendix: Public policies

Query: `SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname`

```csv
schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
public,admin_actions,aa_insert,PERMISSIVE,{authenticated},INSERT,,"(has_role(auth.uid(), 'admin'::app_role) AND (admin_id = auth.uid()))"
public,admin_actions,aa_select,PERMISSIVE,{authenticated},SELECT,"has_role(auth.uid(), 'admin'::app_role)",
public,anonymous_authors,anon_authors_select_admin_or_self,PERMISSIVE,{authenticated},SELECT,"((author_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))",
public,banned_words,admin manage banned words,PERMISSIVE,{authenticated},ALL,"has_role(auth.uid(), 'admin'::app_role)","has_role(auth.uid(), 'admin'::app_role)"
public,banned_words,read banned words,PERMISSIVE,{authenticated},SELECT,true,
public,blocked_users,blocked_users_delete_own,PERMISSIVE,{authenticated},DELETE,"((auth.uid() = blocker_id) OR has_role(auth.uid(), 'admin'::app_role))",
public,blocked_users,blocked_users_insert_own,PERMISSIVE,{authenticated},INSERT,,(auth.uid() = blocker_id)
public,blocked_users,blocked_users_select_own,PERMISSIVE,{authenticated},SELECT,"((auth.uid() = blocker_id) OR has_role(auth.uid(), 'admin'::app_role))",
public,comments,comments_delete_own_or_admin,PERMISSIVE,{public},DELETE,"((auth.uid() = author_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_anonymous_owner('comment'::text, id, auth.uid()))",
public,comments,comments_insert_self,PERMISSIVE,{authenticated},INSERT,,(auth.uid() = author_id)
public,comments,comments_select_all,PERMISSIVE,{authenticated},SELECT,true,
public,comments,comments_update_own,PERMISSIVE,{public},UPDATE,"((auth.uid() = author_id) OR is_anonymous_owner('comment'::text, id, auth.uid()))","((auth.uid() = author_id) OR is_anonymous_owner('comment'::text, id, auth.uid()))"
public,conversation_members,members_delete,PERMISSIVE,{authenticated},DELETE,"((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))",
public,conversation_members,members_insert,PERMISSIVE,{authenticated},INSERT,,"((auth.uid() = user_id) OR is_conversation_member(conversation_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))"
public,conversation_members,members_select,PERMISSIVE,{authenticated},SELECT,"(is_conversation_member(conversation_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))",
public,conversations,conversations_delete_creator,PERMISSIVE,{authenticated},DELETE,"((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role))",
public,conversations,conversations_insert,PERMISSIVE,{authenticated},INSERT,,(auth.uid() = created_by)
public,conversations,conversations_select_member,PERMISSIVE,{authenticated},SELECT,"(is_conversation_member(id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))",
public,conversations,conversations_update_creator,PERMISSIVE,{authenticated},UPDATE,"((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role))",
public,course_links,course_links_delete,PERMISSIVE,{authenticated},DELETE,"((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role))",
public,course_links,course_links_delete_own_or_staff,PERMISSIVE,{authenticated},DELETE,"((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))",
public,course_links,course_links_insert,PERMISSIVE,{authenticated},INSERT,,"(has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role))"
public,course_links,course_links_insert_staff,PERMISSIVE,{authenticated},INSERT,,"(has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_links.course_id) AND ((c.teacher_id = auth.uid()) OR (c.created_by = auth.uid()))))))"
public,course_links,course_links_select_all,PERMISSIVE,{authenticated},SELECT,true,
public,course_links,course_links_update,PERMISSIVE,{authenticated},UPDATE,"((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role))",
public,course_links,course_links_update_own_or_staff,PERMISSIVE,{authenticated},UPDATE,"((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))","((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))"
public,course_updates,cu_delete,PERMISSIVE,{authenticated},DELETE,"((auth.uid() = author_id) OR has_role(auth.uid(), 'admin'::app_role))",
public,course_updates,cu_insert,PERMISSIVE,{authenticated},INSERT,,"((auth.uid() = author_id) AND (has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role)))"
public,course_updates,cu_select,PERMISSIVE,{authenticated},SELECT,true,
public,course_updates,cu_update,PERMISSIVE,{authenticated},UPDATE,"((auth.uid() = author_id) OR has_role(auth.uid(), 'admin'::app_role))",
public,courses,courses_delete_admin,PERMISSIVE,{authenticated},DELETE,"(has_role(auth.uid(), 'admin'::app_role) OR (auth.uid() = created_by))",
public,courses,courses_delete_own_or_staff,PERMISSIVE,{authenticated},DELETE,"((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))",
public,courses,courses_insert_admin,PERMISSIVE,{authenticated},INSERT,,"has_role(auth.uid(), 'admin'::app_role)"
public,courses,courses_insert_admin_or_subadmin,PERMISSIVE,{authenticated},INSERT,,"(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))"
public,courses,courses_insert_teacher_admin,PERMISSIVE,{authenticated},INSERT,,"(has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role))"
public,courses,courses_select_all,PERMISSIVE,{authenticated},SELECT,true,
public,courses,courses_update_own_or_admin,PERMISSIVE,{authenticated},UPDATE,"((auth.uid() = teacher_id) OR (auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role))","((auth.uid() = teacher_id) OR (auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role))"
public,courses,courses_update_own_or_staff,PERMISSIVE,{authenticated},UPDATE,"((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))","((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))"
public,message_reports,message_reports_insert_own,PERMISSIVE,{authenticated},INSERT,,(auth.uid() = reporter_id)
public,message_reports,message_reports_select_own_or_admin,PERMISSIVE,{authenticated},SELECT,"((auth.uid() = reporter_id) OR has_role(auth.uid(), 'admin'::app_role))",
public,message_reports,message_reports_update_admin,PERMISSIVE,{authenticated},UPDATE,"has_role(auth.uid(), 'admin'::app_role)",
public,messages,messages_delete_own_or_admin,PERMISSIVE,{authenticated},DELETE,"((auth.uid() = sender_id) OR has_role(auth.uid(), 'admin'::app_role))",
public,messages,messages_insert_member,PERMISSIVE,{authenticated},INSERT,,"((auth.uid() = sender_id) AND is_conversation_member(conversation_id, auth.uid()))"
public,messages,messages_select_member,PERMISSIVE,{authenticated},SELECT,"is_conversation_member(conversation_id, auth.uid())",
public,notifications,Admins can delete any notification,PERMISSIVE,{public},DELETE,"has_role(auth.uid(), 'admin'::app_role)",
public,notifications,Admins can insert notifications,PERMISSIVE,{public},INSERT,,"(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))"
public,notifications,Users can delete own notifications,PERMISSIVE,{public},DELETE,(auth.uid() = recipient_id),
public,notifications,Users can mark own notifications read,PERMISSIVE,{public},UPDATE,(auth.uid() = recipient_id),(auth.uid() = recipient_id)
public,notifications,Users can send genuine notifications,PERMISSIVE,{authenticated},INSERT,,"((actor_id = auth.uid()) AND (type <> 'announcement'::text) AND (priority = ANY (ARRAY['low'::text, 'normal'::text, 'medium'::text, 'high'::text, 'important'::text, 'urgent'::text])))"
public,notifications,Users read own notifications,PERMISSIVE,{public},SELECT,(auth.uid() = recipient_id),
public,pinned_cards,Admins can insert pinned cards,PERMISSIVE,{authenticated},INSERT,,"(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))"
public,pinned_cards,Admins can update pinned cards,PERMISSIVE,{authenticated},UPDATE,"(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))","(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))"
public,pinned_cards,Allow admins to update pinned_cards,PERMISSIVE,{public},ALL,"(EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))))",
public,pinned_cards,Allow public read access on pinned_cards,PERMISSIVE,{public},SELECT,true,
public,pinned_cards,Users can update their pinned card interaction,PERMISSIVE,{authenticated},UPDATE,(auth.uid() IS NOT NULL),(auth.uid() IS NOT NULL)
public,post_reactions,reactions_manage_own,PERMISSIVE,{authenticated},ALL,(auth.uid() = user_id),(auth.uid() = user_id)
public,post_reactions,reactions_select_all,PERMISSIVE,{authenticated},SELECT,true,
public,post_reports,admin deletes reports,PERMISSIVE,{authenticated},DELETE,"has_role(auth.uid(), 'admin'::app_role)",
public,post_reports,admin updates reports,PERMISSIVE,{authenticated},UPDATE,"has_role(auth.uid(), 'admin'::app_role)","has_role(auth.uid(), 'admin'::app_role)"
public,post_reports,user creates own reports,PERMISSIVE,{authenticated},INSERT,,(auth.uid() = reporter_id)
public,post_reports,user reads own reports,PERMISSIVE,{authenticated},SELECT,"((auth.uid() = reporter_id) OR has_role(auth.uid(), 'admin'::app_role))",
public,posts,posts_delete_own_or_admin,PERMISSIVE,{public},DELETE,"((auth.uid() = author_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_anonymous_owner('post'::text, id, auth.uid()))",
public,posts,posts_insert_self,PERMISSIVE,{authenticated},INSERT,,(auth.uid() = author_id)
public,posts,posts_select_all,PERMISSIVE,{authenticated},SELECT,true,
public,posts,posts_update_own,PERMISSIVE,{public},UPDATE,"((auth.uid() = author_id) OR is_anonymous_owner('post'::text, id, auth.uid()))","((auth.uid() = author_id) OR is_anonymous_owner('post'::text, id, auth.uid()))"
public,profiles,profiles_delete_admin,PERMISSIVE,{authenticated},DELETE,"has_role(auth.uid(), 'admin'::app_role)",
public,profiles,profiles_insert_self,PERMISSIVE,{authenticated},INSERT,,(auth.uid() = id)
public,profiles,profiles_select_all_for_admins,PERMISSIVE,{authenticated},SELECT,"((auth.uid() = id) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND ((user_roles.role = 'admin'::app_role) OR (user_roles.role = 'sub_admin'::app_role))))))",
public,profiles,profiles_select_self_or_admin,PERMISSIVE,{authenticated},SELECT,"((auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role))",
public,profiles,profiles_update_self,PERMISSIVE,{authenticated},UPDATE,"((auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role))","((auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role))"
public,saved_posts,saved_manage_own,PERMISSIVE,{authenticated},ALL,(auth.uid() = user_id),(auth.uid() = user_id)
public,subadmin_permissions,Allow users to read their own permissions or admins to read all,PERMISSIVE,{authenticated},SELECT,"((auth.uid() = user_id) OR is_main_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role)))))",
public,subadmin_permissions,Only main admins can write sub-admin permissions,PERMISSIVE,{authenticated},ALL,is_main_admin(auth.uid()),is_main_admin(auth.uid())
public,user_roles,user_roles_admin_all,PERMISSIVE,{authenticated},ALL,"has_role(auth.uid(), 'admin'::app_role)","has_role(auth.uid(), 'admin'::app_role)"
public,user_roles,user_roles_select_own_or_admin,PERMISSIVE,{authenticated},SELECT,"((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))",
public,user_warnings,uw_insert,PERMISSIVE,{authenticated},INSERT,,"has_role(auth.uid(), 'admin'::app_role)"
public,user_warnings,uw_select,PERMISSIVE,{authenticated},SELECT,"((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))",
```

## Appendix: Public RLS flags

Query: `SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid=relnamespace WHERE nspname='public' AND relkind IN ('r','p') ORDER BY relname`

```csv
relname,relrowsecurity,relforcerowsecurity
admin_actions,t,f
anonymous_authors,t,f
banned_words,t,f
blocked_users,t,f
comments,t,f
conversation_members,t,f
conversations,t,f
course_links,t,f
course_updates,t,f
courses,t,f
message_reports,t,f
messages,t,f
notifications,t,f
pinned_cards,t,f
post_reactions,t,f
post_reports,t,f
posts,t,f
profiles,t,f
saved_posts,t,f
subadmin_permissions,t,f
user_roles,t,f
user_warnings,t,f
```

## Appendix: Table grants

Query: `SELECT * FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated') ORDER BY table_name,grantee,privilege_type`

```csv
grantor,grantee,table_catalog,table_schema,table_name,privilege_type,is_grantable,with_hierarchy
```

## Appendix: Function definitions and signatures

Query: `SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_function_result(p.oid) AS result,p.prosecdef AS security_definer,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname`

```csv
proname,arguments,result,security_definer,definition
admin_adjust_points,"_user uuid, _delta integer",integer,t,"CREATE OR REPLACE FUNCTION public.admin_adjust_points(_user uuid, _delta integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_new INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.profiles SET points = GREATEST(0, points + _delta), updated_at = now() WHERE id = _user RETURNING points INTO v_new;
  RETURN v_new;
END; $function$
"
admin_ban,"_user uuid, _reason text",void,t,"CREATE OR REPLACE FUNCTION public.admin_ban(_user uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR public.has_subadmin_permission(auth.uid(), 'can_suspend')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  UPDATE public.profiles SET banned = true WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'ban', jsonb_build_object('reason', _reason));
END; $function$
"
admin_delete_user,_user uuid,void,t,"CREATE OR REPLACE FUNCTION public.admin_delete_user(_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'delete_user', '{}'::jsonb);
  DELETE FROM auth.users WHERE id = _user;
END; $function$
"
admin_set_teacher_role,_user uuid,void,t,"CREATE OR REPLACE FUNCTION public.admin_set_teacher_role(_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR public.has_subadmin_permission(auth.uid(), 'can_teachers')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  IF _user = auth.uid() THEN 
     RAISE EXCEPTION 'cannot change your own role via this function'; 
   END IF;

  DELETE FROM public.user_roles WHERE user_id = _user;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user, 'teacher');
  
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'set_role', jsonb_build_object('role', 'teacher'));
END; $function$
"
admin_set_user_role,"_user uuid, _role app_role",void,t,"CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user uuid, _role app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_main_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  IF _user = auth.uid() THEN 
     RAISE EXCEPTION 'cannot change your own role via this function'; 
   END IF;

  DELETE FROM public.user_roles WHERE user_id = _user;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user, _role);
  
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'set_role', jsonb_build_object('role', _role));
END; $function$
"
admin_set_verified,"_user uuid, _verified boolean",void,t,"CREATE OR REPLACE FUNCTION public.admin_set_verified(_user uuid, _verified boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.profiles SET verified = _verified WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
  VALUES (auth.uid(), _user, CASE WHEN _verified THEN 'verify' ELSE 'unverify' END, NULL);
END;
$function$
"
admin_set_year,"_user uuid, _year smallint",void,t,"CREATE OR REPLACE FUNCTION public.admin_set_year(_user uuid, _year smallint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'sub_admin'))) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  UPDATE public.profiles SET year = _year WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'set_year', jsonb_build_object('year', _year));
END; $function$
"
admin_suspend,"_user uuid, _days integer, _reason text",void,t,"CREATE OR REPLACE FUNCTION public.admin_suspend(_user uuid, _days integer, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR public.has_subadmin_permission(auth.uid(), 'can_suspend')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  UPDATE public.profiles SET suspended_until = now() + (_days || ' days')::interval WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'suspend', jsonb_build_object('days', _days, 'reason', _reason));
END; $function$
"
admin_unban,_user uuid,void,t,"CREATE OR REPLACE FUNCTION public.admin_unban(_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR public.has_subadmin_permission(auth.uid(), 'can_suspend')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  UPDATE public.profiles SET banned = false, suspended_until = NULL, warning_count = 0 WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'unban', '{}'::jsonb);
END; $function$
"
admin_warn,"_user uuid, _reason text",integer,t,"CREATE OR REPLACE FUNCTION public.admin_warn(_user uuid, _reason text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count INT;
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR public.has_subadmin_permission(auth.uid(), 'can_warn')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  INSERT INTO public.user_warnings (user_id, reason, issued_by) VALUES (_user, _reason, auth.uid());
  UPDATE public.profiles SET warning_count = warning_count + 1 WHERE id = _user RETURNING warning_count INTO v_count;
  
  IF v_count >= 3 THEN
    UPDATE public.profiles SET suspended_until = now() + interval '7 days' WHERE id = _user;
  END IF;
  
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'warn', jsonb_build_object('reason', _reason, 'count', v_count));
  RETURN v_count;
END; $function$
"
auto_verify_on_points,,trigger,t,"CREATE OR REPLACE FUNCTION public.auto_verify_on_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.points >= 1000 AND COALESCE(OLD.verified, false) = false AND NEW.verified = COALESCE(OLD.verified, false) THEN
    NEW.verified := true;
  END IF;
  RETURN NEW;
END;
$function$
"
award_points,"_user uuid, _delta integer",void,t,"CREATE OR REPLACE FUNCTION public.award_points(_user uuid, _delta integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.trusted_profile_update', 'on', true);
  UPDATE public.profiles SET points = GREATEST(0, points + _delta), updated_at = now() WHERE id = _user;
END;
$function$
"
check_message_not_blocked,,trigger,t,"CREATE OR REPLACE FUNCTION public.check_message_not_blocked()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.conversation_members cm
    JOIN public.blocked_users b
      ON (b.blocker_id = cm.user_id AND b.blocked_id = NEW.sender_id)
      OR (b.blocked_id = cm.user_id AND b.blocker_id = NEW.sender_id)
    WHERE cm.conversation_id = NEW.conversation_id
      AND cm.user_id <> NEW.sender_id
  ) THEN
    RAISE EXCEPTION 'blocked: you cannot message a user you have blocked, or who has blocked you';
  END IF;
  RETURN NEW;
END;
$function$
"
compute_rank,_points integer,rank_tier,f,"CREATE OR REPLACE FUNCTION public.compute_rank(_points integer)
 RETURNS rank_tier
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN _points >= 1000 THEN 'diamond'::public.rank_tier
    WHEN _points >= 400  THEN 'platinum'::public.rank_tier
    WHEN _points >= 150  THEN 'gold'::public.rank_tier
    WHEN _points >= 50   THEN 'silver'::public.rank_tier
    ELSE 'bronze'::public.rank_tier
  END;
$function$
"
create_comment_as,"_post_id uuid, _content text, _parent_id uuid, _anonymous boolean",uuid,t,"CREATE OR REPLACE FUNCTION public.create_comment_as(_post_id uuid, _content text, _parent_id uuid DEFAULT NULL::uuid, _anonymous boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_me uuid := auth.uid(); v_id uuid; v_banned boolean; v_until timestamptz;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT banned, suspended_until INTO v_banned, v_until FROM public.profiles WHERE id = v_me;
  IF COALESCE(v_banned,false) OR (v_until IS NOT NULL AND v_until > now()) THEN
    RAISE EXCEPTION 'account suspended';
  END IF;
  IF public.has_role(v_me,'sub_admin') THEN RAISE EXCEPTION 'sub admins cannot comment'; END IF;

  IF NOT _anonymous THEN
    INSERT INTO public.comments (post_id, parent_id, author_id, content, is_anonymous)
    VALUES (_post_id, _parent_id, v_me, _content, false) RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.comments (post_id, parent_id, author_id, content, is_anonymous)
    VALUES (_post_id, _parent_id, NULL, _content, true) RETURNING id INTO v_id;
    INSERT INTO public.anonymous_authors (content_type, content_id, author_id)
    VALUES ('comment', v_id, v_me);
    PERFORM public.award_points(v_me, 2);
  END IF;
  RETURN v_id;
END; $function$
"
create_dm,_other uuid,uuid,t,"CREATE OR REPLACE FUNCTION public.create_dm(_other uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_me UUID := auth.uid(); v_conv UUID; v_existing UUID;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF v_me = _other THEN RAISE EXCEPTION 'cannot dm yourself'; END IF;
  SELECT c.id INTO v_existing
  FROM public.conversations c
  WHERE c.is_group = false
    AND EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = c.id AND m.user_id = v_me)
    AND EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = c.id AND m.user_id = _other)
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  INSERT INTO public.conversations (is_group, created_by) VALUES (false, v_me) RETURNING id INTO v_conv;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (v_conv, v_me), (v_conv, _other);
  RETURN v_conv;
END; $function$
"
create_group,"_name text, _members uuid[]",uuid,t,"CREATE OR REPLACE FUNCTION public.create_group(_name text, _members uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_me UUID := auth.uid(); v_conv UUID; v_uid UUID;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.conversations (is_group, name, created_by) VALUES (true, _name, v_me) RETURNING id INTO v_conv;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (v_conv, v_me) ON CONFLICT DO NOTHING;
  FOREACH v_uid IN ARRAY _members LOOP
    INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (v_conv, v_uid) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN v_conv;
END; $function$
"
create_post_as,"_content text, _images text[], _post_type post_type, _anonymous boolean",uuid,t,"CREATE OR REPLACE FUNCTION public.create_post_as(_content text, _images text[] DEFAULT '{}'::text[], _post_type post_type DEFAULT 'general'::post_type, _anonymous boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_me uuid := auth.uid(); v_id uuid; v_banned boolean; v_until timestamptz;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT banned, suspended_until INTO v_banned, v_until FROM public.profiles WHERE id = v_me;
  IF COALESCE(v_banned,false) OR (v_until IS NOT NULL AND v_until > now()) THEN
    RAISE EXCEPTION 'account suspended';
  END IF;
  IF public.has_role(v_me,'sub_admin') THEN RAISE EXCEPTION 'sub admins cannot post'; END IF;

  IF NOT _anonymous THEN
    INSERT INTO public.posts (author_id, content, images, post_type, is_anonymous)
    VALUES (v_me, _content, _images, _post_type, false) RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.posts (author_id, content, images, post_type, is_anonymous)
    VALUES (NULL, _content, _images, _post_type, true) RETURNING id INTO v_id;
    INSERT INTO public.anonymous_authors (content_type, content_id, author_id)
    VALUES ('post', v_id, v_me);
    PERFORM public.award_points(v_me, 5);
  END IF;
  RETURN v_id;
END; $function$
"
delete_conversation,"_conv_id uuid, _user_id uuid",void,t,"CREATE OR REPLACE FUNCTION public.delete_conversation(_conv_id uuid, _user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conv_id AND (c.created_by = _user_id OR public.has_role(_user_id, 'admin'::public.app_role))
  ) THEN
    RAISE EXCEPTION 'Not authorized to delete this conversation';
  END IF;
  DELETE FROM public.conversations WHERE id = _conv_id;
END; $function$
"
get_anonymous_authors,"_type text, _ids uuid[]","TABLE(content_id uuid, author_id uuid, full_name text, avatar_url text, university_number text)",t,"CREATE OR REPLACE FUNCTION public.get_anonymous_authors(_type text, _ids uuid[])
 RETURNS TABLE(content_id uuid, author_id uuid, full_name text, avatar_url text, university_number text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'sub_admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  SELECT a.content_id, a.author_id, p.full_name, p.avatar_url, p.university_number
  FROM public.anonymous_authors a
  JOIN public.profiles p ON p.id = a.author_id
  WHERE a.content_type = _type AND a.content_id = ANY(_ids);
END; $function$
"
get_conversation_unread_counts,_user_id uuid,"TABLE(conversation_id uuid, unread_count bigint)",t,"CREATE OR REPLACE FUNCTION public.get_conversation_unread_counts(_user_id uuid)
 RETURNS TABLE(conversation_id uuid, unread_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT 
    cm.conversation_id,
    COUNT(m.id) as unread_count
  FROM public.conversation_members cm
  INNER JOIN public.messages m ON m.conversation_id = cm.conversation_id
  WHERE cm.user_id = _user_id
    AND m.sender_id != _user_id
    AND m.created_at > cm.last_read_at
  GROUP BY cm.conversation_id;
$function$
"
get_courses_with_counts,,"TABLE(id uuid, name text, major text, year smallint, semester smallint, teacher_name text, files_count bigint, links_count bigint, created_at timestamp with time zone)",t,"CREATE OR REPLACE FUNCTION public.get_courses_with_counts()
 RETURNS TABLE(id uuid, name text, major text, year smallint, semester smallint, teacher_name text, files_count bigint, links_count bigint, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.id, c.name, c.major::text, c.year, c.semester,
    COALESCE(p.full_name, '') AS teacher_name,
    (SELECT COUNT(*) FROM course_links cl WHERE cl.course_id = c.id AND cl.link_type = 'file') AS files_count,
    (SELECT COUNT(*) FROM course_links cl WHERE cl.course_id = c.id AND (cl.link_type IS NULL OR cl.link_type = '')) AS links_count,
    c.created_at
  FROM courses c
  LEFT JOIN profiles p ON c.teacher_id = p.id
  ORDER BY c.created_at DESC;
$function$
"
get_daily_posts,since timestamp with time zone,"TABLE(day text, count bigint)",t,"CREATE OR REPLACE FUNCTION public.get_daily_posts(since timestamp with time zone)
 RETURNS TABLE(day text, count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT to_char(created_at, 'MM-DD') AS day, COUNT(*)::bigint AS count
  FROM posts
  WHERE created_at >= since
  GROUP BY to_char(created_at, 'MM-DD')
  ORDER BY day;
$function$
"
get_daily_user_registrations,since timestamp with time zone,"TABLE(day text, count bigint)",t,"CREATE OR REPLACE FUNCTION public.get_daily_user_registrations(since timestamp with time zone)
 RETURNS TABLE(day text, count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT to_char(created_at, 'MM-DD') AS day, COUNT(*)::bigint AS count
  FROM profiles
  WHERE created_at >= since
  GROUP BY to_char(created_at, 'MM-DD')
  ORDER BY day;
$function$
"
get_leaderboard_profiles,"_major major_code, _year smallint","TABLE(id uuid, full_name text, avatar_url text, major major_code, year smallint, points integer, university_number text, verified boolean)",t,"CREATE OR REPLACE FUNCTION public.get_leaderboard_profiles(_major major_code DEFAULT NULL::major_code, _year smallint DEFAULT NULL::smallint)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, major major_code, year smallint, points integer, university_number text, verified boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, 
    p.full_name, 
    p.avatar_url, 
    p.major, 
    p.year, 
    p.points, 
    CASE WHEN p.hide_university_number THEN NULL ELSE p.university_number END AS university_number,
    p.verified
  FROM public.profiles p
  WHERE (_major IS NULL OR p.major = _major)
    AND (_year IS NULL OR p.year = _year)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = p.id 
      AND ur.role IN ('admin', 'sub_admin')
    )
  ORDER BY p.points DESC
  LIMIT 50;
END; $function$
"
get_public_profiles,_ids uuid[],"TABLE(id uuid, full_name text, avatar_url text, major major_code, year smallint, bio text, points integer, university_number text, verified boolean)",t,"CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
 RETURNS TABLE(id uuid, full_name text, avatar_url text, major major_code, year smallint, bio text, points integer, university_number text, verified boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name, p.avatar_url, p.major, p.year, p.bio, p.points,
    CASE WHEN p.hide_university_number THEN NULL ELSE p.university_number END AS university_number,
    p.verified
  FROM public.profiles p
  LEFT JOIN public.user_roles r ON p.id = r.user_id AND r.role = 'sub_admin'
  WHERE p.id = ANY(_ids)
    AND (r.user_id IS NULL OR p.id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
END; $function$
"
get_recent_admin_activity,,"TABLE(id uuid, activity_type text, description text, created_at timestamp with time zone, user_name text)",t,"CREATE OR REPLACE FUNCTION public.get_recent_admin_activity()
 RETURNS TABLE(id uuid, activity_type text, description text, created_at timestamp with time zone, user_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.id, 'admin_action'::text, a.action || ' - ' || COALESCE(p.full_name, ''), a.created_at, COALESCE(p.full_name, '')
  FROM admin_actions a
  LEFT JOIN profiles p ON a.target_user_id = p.id
  ORDER BY a.created_at DESC
  LIMIT 10;
$function$
"
get_unread_message_count,_user_id uuid,integer,t,"CREATE OR REPLACE FUNCTION public.get_unread_message_count(_user_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT COUNT(*)::int
  FROM public.messages m
  INNER JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
  WHERE cm.user_id = _user_id
    AND m.sender_id != _user_id
    AND m.created_at > cm.last_read_at;
$function$
"
handle_new_user,,trigger,t,"CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_univ TEXT; v_name TEXT; v_major public.major_code; v_year SMALLINT; v_role public.app_role;
BEGIN
  v_univ := COALESCE(NEW.raw_user_meta_data->>'university_number', '');
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'مستخدم');
  BEGIN v_major := (NEW.raw_user_meta_data->>'major')::public.major_code; EXCEPTION WHEN OTHERS THEN v_major := NULL; END;
  BEGIN v_year := (NEW.raw_user_meta_data->>'year')::SMALLINT; EXCEPTION WHEN OTHERS THEN v_year := NULL; END;
  BEGIN v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student'); EXCEPTION WHEN OTHERS THEN v_role := 'student'; END;

  IF v_univ = '' THEN v_univ := 'U' || substr(NEW.id::text, 1, 8); END IF;

  INSERT INTO public.profiles (id, university_number, full_name, major, year, email, must_change_password)
  VALUES (NEW.id, v_univ, v_name, v_major, v_year, NEW.email, COALESCE((NEW.raw_user_meta_data->>'must_change_password')::BOOLEAN, false))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $function$
"
has_role,"_user_id uuid, _role app_role",boolean,t,"CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$function$
"
has_subadmin_permission,"_user_id uuid, _permission text",boolean,t,"CREATE OR REPLACE FUNCTION public.has_subadmin_permission(_user_id uuid, _permission text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_has_perm BOOLEAN;
BEGIN
  CASE _permission
    WHEN 'can_warn' THEN
      SELECT can_warn INTO v_has_perm FROM public.subadmin_permissions WHERE user_id = _user_id;
    WHEN 'can_suspend' THEN
      SELECT can_suspend INTO v_has_perm FROM public.subadmin_permissions WHERE user_id = _user_id;
    WHEN 'can_courses' THEN
      SELECT can_courses INTO v_has_perm FROM public.subadmin_permissions WHERE user_id = _user_id;
    WHEN 'can_reports' THEN
      SELECT can_reports INTO v_has_perm FROM public.subadmin_permissions WHERE user_id = _user_id;
    WHEN 'can_words' THEN
      SELECT can_words INTO v_has_perm FROM public.subadmin_permissions WHERE user_id = _user_id;
    WHEN 'can_teachers' THEN
      SELECT can_teachers INTO v_has_perm FROM public.subadmin_permissions WHERE user_id = _user_id;
    ELSE
      v_has_perm := FALSE;
  END CASE;
  RETURN COALESCE(v_has_perm, FALSE);
END; $function$
"
is_anonymous_owner,"_type text, _id uuid, _user uuid",boolean,t,"CREATE OR REPLACE FUNCTION public.is_anonymous_owner(_type text, _id uuid, _user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.anonymous_authors
    WHERE content_type = _type AND content_id = _id AND author_id = _user
  );
$function$
"
is_conversation_member,"_conv uuid, _user uuid",boolean,t,"CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv uuid, _user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conv AND user_id = _user
  );
$function$
"
is_main_admin,_user_id uuid,boolean,t,"CREATE OR REPLACE FUNCTION public.is_main_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_univ TEXT;
  v_email TEXT;
BEGIN
  SELECT university_number, email INTO v_univ, v_email FROM public.profiles WHERE id = _user_id;
  RETURN v_univ = '2011099840' OR LOWER(v_email) = 'khdrmamon@gmail.com';
END; $function$
"
leave_conversation,"_conv_id uuid, _user_id uuid",void,t,"CREATE OR REPLACE FUNCTION public.leave_conversation(_conv_id uuid, _user_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  DELETE FROM public.conversation_members
  WHERE conversation_id = _conv_id AND user_id = _user_id;
$function$
"
mark_conversation_read,"_conv_id uuid, _user_id uuid",void,t,"CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conv_id uuid, _user_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  UPDATE public.conversation_members
  SET last_read_at = now()
  WHERE conversation_id = _conv_id AND user_id = _user_id;
$function$
"
on_comment_insert_points,,trigger,t,"CREATE OR REPLACE FUNCTION public.on_comment_insert_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN PERFORM public.award_points(NEW.author_id, 2); RETURN NEW; END; $function$
"
on_post_insert_points,,trigger,t,"CREATE OR REPLACE FUNCTION public.on_post_insert_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN PERFORM public.award_points(NEW.author_id, 5); RETURN NEW; END; $function$
"
on_reaction_insert_points,,trigger,t,"CREATE OR REPLACE FUNCTION public.on_reaction_insert_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_author UUID;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN PERFORM public.award_points(v_author, 1); END IF;
  RETURN NEW;
END; $function$
"
on_report_confirmed,,trigger,t,"CREATE OR REPLACE FUNCTION public.on_report_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_author UUID;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
    IF v_author IS NOT NULL THEN PERFORM public.award_points(v_author, -20); END IF;
  END IF;
  RETURN NEW;
END; $function$
"
protect_accepted_answer,,trigger,t,"CREATE OR REPLACE FUNCTION public.protect_accepted_answer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.accepted_answer_id IS NOT DISTINCT FROM OLD.accepted_answer_id THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.accepted_answer_id IS NOT NULL THEN
    IF NEW.post_type <> 'question' THEN
      RAISE EXCEPTION 'accepted_answer_id can only be set on question posts';
    END IF;
    IF OLD.accepted_answer_id IS NOT NULL THEN
      RAISE EXCEPTION 'an answer is already accepted for this question — clear it before accepting another';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.comments c WHERE c.id = NEW.accepted_answer_id AND c.post_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'accepted_answer_id must reference a comment on this post';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
"
protect_pinned_card_columns,,trigger,t,"CREATE OR REPLACE FUNCTION public.protect_pinned_card_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller_key text := auth.uid()::text;
  old_vote jsonb;
  new_vote jsonb;
  old_participates boolean;
  new_participates boolean;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'sub_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NEW.type IS DISTINCT FROM OLD.type
     OR NEW.theme IS DISTINCT FROM OLD.theme
     OR NEW.badge_text IS DISTINCT FROM OLD.badge_text
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.end_date IS DISTINCT FROM OLD.end_date
     OR NEW.action_button_text IS DISTINCT FROM OLD.action_button_text
     OR NEW.action_button_url IS DISTINCT FROM OLD.action_button_url
     OR NEW.target_year IS DISTINCT FROM OLD.target_year
     OR NEW.target_major IS DISTINCT FROM OLD.target_major
     OR NEW.poll_options IS DISTINCT FROM OLD.poll_options
     OR NEW.enabled IS DISTINCT FROM OLD.enabled
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only administrators can edit pinned card settings';
  END IF;

  old_vote := COALESCE(OLD.votes, '{}'::jsonb) - caller_key;
  new_vote := COALESCE(NEW.votes, '{}'::jsonb) - caller_key;
  IF new_vote IS DISTINCT FROM old_vote THEN
    RAISE EXCEPTION 'Cannot change another user vote';
  END IF;

  old_participates := COALESCE(OLD.participants, '[]'::jsonb) @> jsonb_build_array(caller_key);
  new_participates := COALESCE(NEW.participants, '[]'::jsonb) @> jsonb_build_array(caller_key);
  IF (
    SELECT COALESCE(jsonb_agg(item ORDER BY item::text), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(NEW.participants, '[]'::jsonb)) item
    WHERE item <> to_jsonb(caller_key)
  ) IS DISTINCT FROM (
    SELECT COALESCE(jsonb_agg(item ORDER BY item::text), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(OLD.participants, '[]'::jsonb)) item
    WHERE item <> to_jsonb(caller_key)
  ) THEN
    RAISE EXCEPTION 'Cannot change another participant';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
"
protect_privileged_profile_columns,,trigger,t,"CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin')
     OR current_setting('app.trusted_profile_update', true) = 'on' THEN
    RETURN NEW;
  END IF;

  NEW.points := OLD.points;
  NEW.banned := OLD.banned;
  NEW.suspended_until := OLD.suspended_until;
  NEW.warning_count := OLD.warning_count;
  NEW.must_change_password := OLD.must_change_password;
  NEW.email := OLD.email;
  NEW.verified := OLD.verified;
  RETURN NEW;
END;
$function$
"
search_public_profiles,_q text,"TABLE(id uuid, full_name text, university_number text, avatar_url text)",t,"CREATE OR REPLACE FUNCTION public.search_public_profiles(_q text)
 RETURNS TABLE(id uuid, full_name text, university_number text, avatar_url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name,
    CASE WHEN p.hide_university_number THEN NULL ELSE p.university_number END AS university_number,
    p.avatar_url
  FROM public.profiles p
  LEFT JOIN public.user_roles r ON p.id = r.user_id AND r.role = 'sub_admin'
  WHERE (p.full_name ILIKE '%' || _q || '%' OR p.university_number ILIKE '%' || _q || '%')
    AND (r.user_id IS NULL OR p.id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  LIMIT 20;
END; $function$
"
toggle_pinned_card_participation,p_user_id uuid,jsonb,f,"CREATE OR REPLACE FUNCTION public.toggle_pinned_card_participation(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  current_participants jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT participants
  INTO current_participants
  FROM public.pinned_cards
  WHERE id = 'pinned_featured_event_1'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pinned card not found';
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
$function$
"
update_updated_at_column,,trigger,f,"CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
"
vote_on_poll,"p_user_id uuid, p_option_id text",jsonb,f,"CREATE OR REPLACE FUNCTION public.vote_on_poll(p_user_id uuid, p_option_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  current_votes jsonb;
  available_options jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT votes, poll_options
  INTO current_votes, available_options
  FROM public.pinned_cards
  WHERE id = 'pinned_featured_event_1'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pinned card not found';
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
$function$
"
```

## Appendix: Function EXECUTE grants

Query: `SELECT * FROM information_schema.routine_privileges WHERE routine_schema='public' AND grantee IN ('anon','authenticated') ORDER BY routine_name,grantee`

```csv
grantor,grantee,specific_catalog,specific_schema,specific_name,routine_catalog,routine_schema,routine_name,privilege_type,is_grantable
```

## Appendix: Enums

Query: `SELECT n.nspname,t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace ORDER BY n.nspname,t.typname,e.enumsortorder`

```csv
nspname,typname,enumlabel,enumsortorder
auth,aal_level,aal1,1
auth,aal_level,aal2,2
auth,aal_level,aal3,3
auth,code_challenge_method,s256,1
auth,code_challenge_method,plain,2
auth,factor_status,unverified,1
auth,factor_status,verified,2
auth,factor_type,totp,1
auth,factor_type,webauthn,2
auth,factor_type,phone,3
auth,factor_type,recovery_code,4
auth,oauth_authorization_status,pending,1
auth,oauth_authorization_status,approved,2
auth,oauth_authorization_status,denied,3
auth,oauth_authorization_status,expired,4
auth,oauth_client_type,public,1
auth,oauth_client_type,confidential,2
auth,oauth_registration_type,dynamic,1
auth,oauth_registration_type,manual,2
auth,oauth_response_type,code,1
auth,one_time_token_type,confirmation_token,1
auth,one_time_token_type,reauthentication_token,2
auth,one_time_token_type,recovery_token,3
auth,one_time_token_type,email_change_token_new,4
auth,one_time_token_type,email_change_token_current,5
auth,one_time_token_type,phone_change_token,6
public,app_role,student,1
public,app_role,teacher,2
public,app_role,admin,3
public,app_role,sub_admin,4
public,major_code,it,1
public,major_code,is,2
public,major_code,se,3
public,post_type,general,1
public,post_type,question,2
public,rank_tier,bronze,1
public,rank_tier,silver,2
public,rank_tier,gold,3
public,rank_tier,platinum,4
public,rank_tier,diamond,5
public,reaction_type,like,1
public,reaction_type,love,2
public,reaction_type,haha,3
public,reaction_type,wow,4
public,reaction_type,sad,5
public,report_status,pending,1
public,report_status,confirmed,2
public,report_status,dismissed,3
realtime,action,INSERT,1
realtime,action,UPDATE,2
realtime,action,DELETE,3
realtime,action,TRUNCATE,4
realtime,action,ERROR,5
realtime,equality_op,eq,1
realtime,equality_op,neq,2
realtime,equality_op,lt,3
realtime,equality_op,lte,4
realtime,equality_op,gt,5
realtime,equality_op,gte,6
realtime,equality_op,in,7
realtime,equality_op,like,8
realtime,equality_op,ilike,9
realtime,equality_op,is,10
realtime,equality_op,match,11
realtime,equality_op,imatch,12
realtime,equality_op,isdistinct,13
storage,buckettype,STANDARD,1
storage,buckettype,ANALYTICS,2
storage,buckettype,VECTOR,3
```

## Appendix: Triggers

Query: `SELECT n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid) AS definition,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','storage','auth') ORDER BY n.nspname,c.relname,t.tgname`

```csv
nspname,relname,tgname,definition,tgenabled
auth,users,on_auth_user_created,CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user(),O
public,comments,trg_comment_points,CREATE TRIGGER trg_comment_points AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION on_comment_insert_points(),O
public,conversations,conversations_updated,CREATE TRIGGER conversations_updated BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(),O
public,courses,courses_updated,CREATE TRIGGER courses_updated BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(),O
public,messages,trg_check_message_not_blocked,CREATE TRIGGER trg_check_message_not_blocked BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION check_message_not_blocked(),O
public,pinned_cards,trg_protect_pinned_card_columns,CREATE TRIGGER trg_protect_pinned_card_columns BEFORE UPDATE ON public.pinned_cards FOR EACH ROW EXECUTE FUNCTION protect_pinned_card_columns(),O
public,post_reactions,trg_reaction_points,CREATE TRIGGER trg_reaction_points AFTER INSERT ON public.post_reactions FOR EACH ROW EXECUTE FUNCTION on_reaction_insert_points(),O
public,post_reports,trg_report_confirmed,CREATE TRIGGER trg_report_confirmed AFTER UPDATE ON public.post_reports FOR EACH ROW EXECUTE FUNCTION on_report_confirmed(),O
public,posts,posts_updated,CREATE TRIGGER posts_updated BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(),O
public,posts,trg_post_points,CREATE TRIGGER trg_post_points AFTER INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION on_post_insert_points(),O
public,posts,trg_protect_accepted_answer,CREATE TRIGGER trg_protect_accepted_answer BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION protect_accepted_answer(),O
public,profiles,profiles_updated,CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(),O
public,profiles,trg_auto_verify_on_points,CREATE TRIGGER trg_auto_verify_on_points BEFORE UPDATE OF points ON public.profiles FOR EACH ROW EXECUTE FUNCTION auto_verify_on_points(),O
public,profiles,trg_protect_privileged_profile_columns,CREATE TRIGGER trg_protect_privileged_profile_columns BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_privileged_profile_columns(),O
storage,buckets,enforce_bucket_name_length_trigger,CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length(),O
storage,buckets,enforce_versioning_status_transition,CREATE TRIGGER enforce_versioning_status_transition BEFORE UPDATE OF versioning_status ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_versioning_status_transition(),O
storage,buckets,protect_active_lifecycle_states,CREATE TRIGGER protect_active_lifecycle_states BEFORE DELETE ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_active_lifecycle_states(),O
storage,buckets,protect_bucket_control_insert,CREATE TRIGGER protect_bucket_control_insert BEFORE INSERT ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns('service_role'),O
storage,buckets,protect_bucket_control_update,"CREATE TRIGGER protect_bucket_control_update BEFORE UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns()",O
storage,buckets,protect_bucket_control_update_role,"CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('service_role')",O
storage,buckets,protect_buckets_delete,CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete(),O
storage,buckets,wake_lifecycle_on_policy_write,CREATE TRIGGER wake_lifecycle_on_policy_write AFTER INSERT OR UPDATE OF lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.wake_lifecycle_state(),O
storage,buckets,wake_lifecycle_on_versioning_enable,CREATE TRIGGER wake_lifecycle_on_versioning_enable AFTER UPDATE OF versioning_status ON storage.buckets FOR EACH ROW WHEN ((new.lifecycle_configuration IS NOT NULL)) EXECUTE FUNCTION storage.wake_lifecycle_state(),O
storage,objects,protect_objects_delete,CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete(),O
storage,objects,update_objects_updated_at,CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column(),O
```

## Appendix: Storage buckets

Query: `SELECT id,name,public,file_size_limit,allowed_mime_types FROM storage.buckets ORDER BY id`

```csv
id,name,public,file_size_limit,allowed_mime_types
avatars,avatars,f,,
course-files,course-files,f,,
post-images,post-images,f,,
```

## Appendix: Storage policies

Query: `SELECT * FROM pg_policies WHERE schemaname='storage' ORDER BY tablename,policyname`

```csv
schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
storage,objects,avatars_delete,PERMISSIVE,{authenticated},DELETE,((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)),
storage,objects,avatars_read,PERMISSIVE,{authenticated},SELECT,(bucket_id = 'avatars'::text),
storage,objects,avatars_update,PERMISSIVE,{authenticated},UPDATE,((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)),
storage,objects,avatars_write,PERMISSIVE,{authenticated},INSERT,,((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))
storage,objects,coursefiles_delete,PERMISSIVE,{authenticated},DELETE,"((bucket_id = 'course-files'::text) AND (has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role)))",
storage,objects,coursefiles_delete_own_or_staff,PERMISSIVE,{authenticated},DELETE,"((bucket_id = 'course-files'::text) AND ((auth.uid() = owner) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)))",
storage,objects,coursefiles_read,PERMISSIVE,{authenticated},SELECT,(bucket_id = 'course-files'::text),
storage,objects,coursefiles_read_authenticated,PERMISSIVE,{authenticated},SELECT,(bucket_id = 'course-files'::text),
storage,objects,coursefiles_update_own_or_staff,PERMISSIVE,{authenticated},UPDATE,"((bucket_id = 'course-files'::text) AND ((auth.uid() = owner) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)))",(bucket_id = 'course-files'::text)
storage,objects,coursefiles_write,PERMISSIVE,{authenticated},INSERT,,"((bucket_id = 'course-files'::text) AND (has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role)))"
storage,objects,coursefiles_write_staff,PERMISSIVE,{authenticated},INSERT,,"((bucket_id = 'course-files'::text) AND (has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE (((c.id)::text = (storage.foldername(c.name))[1]) AND ((c.teacher_id = auth.uid()) OR (c.created_by = auth.uid())))))))"
storage,objects,postimg_delete,PERMISSIVE,{authenticated},DELETE,"((bucket_id = 'post-images'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR has_role(auth.uid(), 'admin'::app_role)))",
storage,objects,postimg_read,PERMISSIVE,{authenticated},SELECT,(bucket_id = 'post-images'::text),
storage,objects,postimg_write,PERMISSIVE,{authenticated},INSERT,,((bucket_id = 'post-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))
```

## Appendix: Realtime publications

Query: `SELECT * FROM pg_publication_tables ORDER BY pubname,schemaname,tablename`

```csv
pubname,schemaname,tablename,attnames,rowfilter
supabase_realtime,public,comments,"{id,post_id,parent_id,author_id,content,created_at,is_anonymous}",
supabase_realtime,public,messages,"{id,conversation_id,sender_id,content,created_at}",
supabase_realtime,public,notifications,"{id,recipient_id,actor_id,actor_name,actor_avatar,type,priority,title,body,link,read,created_at}",
supabase_realtime,public,post_reactions,"{post_id,user_id,reaction,created_at}",
supabase_realtime_messages_publication,realtime,messages_2026_10_30,"{topic,extension,payload,event,private,updated_at,inserted_at,id,binary_payload,skip_broadcast}",
supabase_realtime_messages_publication,realtime,messages_2026_10_31,"{topic,extension,payload,event,private,updated_at,inserted_at,id,binary_payload,skip_broadcast}",
supabase_realtime_messages_publication,realtime,messages_2026_11_01,"{topic,extension,payload,event,private,updated_at,inserted_at,id,binary_payload,skip_broadcast}",
supabase_realtime_messages_publication,realtime,messages_2026_11_02,"{topic,extension,payload,event,private,updated_at,inserted_at,id,binary_payload,skip_broadcast}",
supabase_realtime_messages_publication,realtime,messages_2026_11_03,"{topic,extension,payload,event,private,updated_at,inserted_at,id,binary_payload,skip_broadcast}",
```

## Appendix: frontend literal from/rpc inventory

Includes storage `.from()` bucket calls; classify separately from public relations. Cast RPC syntax also scanned. Dynamic names require manual review.

| Kind | Name | Source | Present as public object |
|---|---|---|---|
| from | `admin_actions` | `src/components/admin/ActivityLogTab.tsx:145` | yes |
| from | `admin_actions` | `src/components/admin/RecentActivity.tsx:27` | yes |
| from | `anonymous_authors` | `src/lib/anonymous.ts:56` | yes |
| from | `banned_words` | `src/components/CreatePost.tsx:71` | yes |
| from | `banned_words` | `src/components/admin/BannedWordsTab.tsx:16` | yes |
| from | `banned_words` | `src/components/admin/BannedWordsTab.tsx:22` | yes |
| from | `banned_words` | `src/components/admin/BannedWordsTab.tsx:35` | yes |
| from | `blocked_users` | `src/routes/_authenticated/messages.$id.tsx:92` | yes |
| from | `blocked_users` | `src/routes/_authenticated/messages.$id.tsx:104` | yes |
| from | `blocked_users` | `src/routes/_authenticated/messages.$id.tsx:111` | yes |
| from | `comments` | `src/components/GlobalSearchDialog.tsx:133` | yes |
| from | `comments` | `src/components/GlobalSearchDialog.tsx:174` | yes |
| from | `comments` | `src/components/PostList.tsx:57` | yes |
| from | `comments` | `src/components/admin/ActivityLogTab.tsx:52` | yes |
| from | `comments` | `src/components/admin/UsersTable.tsx:124` | yes |
| from | `comments` | `src/components/admin/UsersTable.tsx:805` | yes |
| from | `comments` | `src/components/courses/QuestionCard.tsx:45` | yes |
| from | `comments` | `src/components/courses/QuestionCard.tsx:73` | yes |
| from | `comments` | `src/components/courses/QuestionCard.tsx:103` | yes |
| from | `comments` | `src/lib/notificationsStore.ts:173` | yes |
| from | `comments` | `src/routes/_authenticated/leaderboard.tsx:196` | yes |
| from | `comments` | `src/routes/_authenticated/leaderboard.tsx:299` | yes |
| from | `comments` | `src/routes/_authenticated/posts.$id.tsx:88` | yes |
| from | `comments` | `src/routes/_authenticated/posts.$id.tsx:194` | yes |
| from | `comments` | `src/routes/_authenticated/posts.$id.tsx:522` | yes |
| from | `comments` | `src/routes/_authenticated/posts.$id.tsx:709` | yes |
| from | `comments` | `src/routes/_authenticated/profile.$id.tsx:146` | yes |
| from | `conversation_members` | `src/components/MessagesShell.tsx:116` | yes |
| from | `conversation_members` | `src/components/MessagesShell.tsx:131` | yes |
| from | `conversation_members` | `src/lib/chatUtils.ts:22` | yes |
| from | `conversation_members` | `src/lib/chatUtils.ts:30` | yes |
| from | `conversation_members` | `src/lib/chatUtils.ts:69` | yes |
| from | `conversation_members` | `src/lib/chatUtils.ts:73` | yes |
| from | `conversation_members` | `src/lib/notificationsStore.ts:249` | yes |
| from | `conversation_members` | `src/routes/_authenticated/messages.$id.tsx:146` | yes |
| from | `conversation_members` | `src/routes/_authenticated/messages.$id.tsx:278` | yes |
| from | `conversation_members` | `src/routes/_authenticated/messages.$id.tsx:286` | yes |
| from | `conversations` | `src/components/MessagesShell.tsx:122` | yes |
| from | `conversations` | `src/lib/chatUtils.ts:38` | yes |
| from | `conversations` | `src/lib/chatUtils.ts:54` | yes |
| from | `conversations` | `src/routes/_authenticated/messages.$id.tsx:143` | yes |
| from | `conversations` | `src/routes/_authenticated/messages.$id.tsx:302` | yes |
| from | `course-files` | `src/components/courses/FilesTab.tsx:85` | MISSING public relation / bucket context |
| from | `course-files` | `src/components/courses/FilesTab.tsx:144` | MISSING public relation / bucket context |
| from | `course_links` | `src/components/admin/CoursesManagementTab.tsx:50` | yes |
| from | `course_links` | `src/components/admin/CoursesManagementTab.tsx:51` | yes |
| from | `course_links` | `src/components/courses/FilesTab.tsx:57` | yes |
| from | `course_links` | `src/components/courses/FilesTab.tsx:94` | yes |
| from | `course_links` | `src/components/courses/FilesTab.tsx:145` | yes |
| from | `course_links` | `src/components/courses/FilesTab.tsx:158` | yes |
| from | `course_links` | `src/components/courses/FilesTab.tsx:174` | yes |
| from | `course_links` | `src/components/courses/LinksTab.tsx:49` | yes |
| from | `course_links` | `src/components/courses/LinksTab.tsx:60` | yes |
| from | `course_links` | `src/components/courses/LinksTab.tsx:73` | yes |
| from | `course_links` | `src/components/courses/LinksTab.tsx:291` | yes |
| from | `course_links` | `src/routes/_authenticated/courses.index.tsx:180` | yes |
| from | `course_updates` | `src/components/courses/UpdatesTab.tsx:46` | yes |
| from | `course_updates` | `src/components/courses/UpdatesTab.tsx:67` | yes |
| from | `course_updates` | `src/components/courses/UpdatesTab.tsx:81` | yes |
| from | `course_updates` | `src/components/courses/UpdatesTab.tsx:93` | yes |
| from | `courses` | `src/components/admin/AddTeacherCard.tsx:33` | yes |
| from | `courses` | `src/components/admin/AddTeacherCard.tsx:86` | yes |
| from | `courses` | `src/components/admin/AdminSearch.tsx:32` | yes |
| from | `courses` | `src/components/admin/CoursesManagementTab.tsx:41` | yes |
| from | `courses` | `src/components/courses/EditCourseDialog.tsx:66` | yes |
| from | `courses` | `src/components/courses/ScheduleTab.tsx:35` | yes |
| from | `courses` | `src/routes/_authenticated/courses.$id.manage.tsx:59` | yes |
| from | `courses` | `src/routes/_authenticated/courses.$id.manage.tsx:110` | yes |
| from | `courses` | `src/routes/_authenticated/courses.$id.manage.tsx:123` | yes |
| from | `courses` | `src/routes/_authenticated/courses.$id.tsx:61` | yes |
| from | `courses` | `src/routes/_authenticated/courses.$id.tsx:83` | yes |
| from | `courses` | `src/routes/_authenticated/courses.index.tsx:68` | yes |
| from | `courses` | `src/routes/_authenticated/courses.index.tsx:131` | yes |
| from | `courses` | `src/routes/_authenticated/courses.index.tsx:837` | yes |
| from | `courses` | `src/routes/_authenticated/courses.mine.tsx:41` | yes |
| from | `courses` | `src/routes/_authenticated/leaderboard.tsx:101` | yes |
| from | `courses` | `src/routes/_authenticated/leaderboard.tsx:197` | yes |
| from | `message_reports` | `src/components/admin/ReportsTab.tsx:364` | yes |
| from | `message_reports` | `src/components/admin/ReportsTab.tsx:389` | yes |
| from | `message_reports` | `src/components/admin/ReportsTab.tsx:404` | yes |
| from | `message_reports` | `src/routes/_authenticated/messages.$id.tsx:249` | yes |
| from | `messages` | `src/components/MessagesShell.tsx:133` | yes |
| from | `messages` | `src/components/admin/StatsCards.tsx:18` | yes |
| from | `messages` | `src/components/admin/UsersTable.tsx:129` | yes |
| from | `messages` | `src/lib/notificationsStore.ts:256` | yes |
| from | `messages` | `src/routes/_authenticated/messages.$id.tsx:172` | yes |
| from | `messages` | `src/routes/_authenticated/messages.$id.tsx:219` | yes |
| from | `messages` | `src/routes/_authenticated/messages.$id.tsx:290` | yes |
| from | `name_change_requests` | `src/components/admin/RecentActivity.tsx:26` | MISSING public relation / bucket context |
| from | `name_change_requests` | `src/lib/nameChangeRequests.ts:46` | MISSING public relation / bucket context |
| from | `name_change_requests` | `src/lib/nameChangeRequests.ts:64` | MISSING public relation / bucket context |
| from | `name_change_requests` | `src/lib/nameChangeRequests.ts:85` | MISSING public relation / bucket context |
| from | `name_change_requests` | `src/lib/nameChangeRequests.ts:118` | MISSING public relation / bucket context |
| from | `notifications` | `src/lib/notificationsStore.ts:27` | yes |
| from | `notifications` | `src/lib/notificationsStore.ts:80` | yes |
| from | `notifications` | `src/lib/notificationsStore.ts:139` | yes |
| from | `notifications` | `src/lib/notificationsStore.ts:351` | yes |
| from | `notifications` | `src/lib/notificationsStore.ts:371` | yes |
| from | `notifications` | `src/lib/notificationsStore.ts:389` | yes |
| from | `notifications` | `src/lib/notificationsStore.ts:409` | yes |
| from | `notifications` | `src/lib/notificationsStore.ts:420` | yes |
| from | `notifications` | `src/lib/notificationsStore.ts:440` | yes |
| from | `notifications` | `src/lib/notificationsStore.ts:455` | yes |
| from | `notifications` | `src/lib/notificationsStore.ts:469` | yes |
| from | `pinned_cards` | `src/lib/pinnedCardStore.ts:86` | yes |
| from | `pinned_cards` | `src/lib/pinnedCardStore.ts:120` | yes |
| from | `pinned_cards` | `src/lib/pinnedCardStore.ts:192` | yes |
| from | `pinned_cards` | `src/lib/pinnedCardStore.ts:221` | yes |
| from | `post_reactions` | `src/components/GlobalSearchDialog.tsx:132` | yes |
| from | `post_reactions` | `src/components/PostCard.tsx:124` | yes |
| from | `post_reactions` | `src/components/PostCard.tsx:131` | yes |
| from | `post_reactions` | `src/components/PostList.tsx:56` | yes |
| from | `post_reactions` | `src/components/admin/ActivityLogTab.tsx:58` | yes |
| from | `post_reactions` | `src/lib/notificationsStore.ts:181` | yes |
| from | `post_reports` | `src/components/PostCard.tsx:468` | yes |
| from | `post_reports` | `src/components/admin/RecentActivity.tsx:25` | yes |
| from | `post_reports` | `src/components/admin/ReportsTab.tsx:59` | yes |
| from | `post_reports` | `src/components/admin/ReportsTab.tsx:95` | yes |
| from | `post_reports` | `src/components/admin/ReportsTab.tsx:129` | yes |
| from | `post_reports` | `src/components/admin/ReportsTab.tsx:176` | yes |
| from | `post_reports` | `src/components/admin/StatsCards.tsx:15` | yes |
| from | `posts` | `src/components/GlobalSearchDialog.tsx:117` | yes |
| from | `posts` | `src/components/GlobalSearchDialog.tsx:189` | yes |
| from | `posts` | `src/components/PostCard.tsx:106` | yes |
| from | `posts` | `src/components/PostList.tsx:28` | yes |
| from | `posts` | `src/components/admin/ActivityLogTab.tsx:46` | yes |
| from | `posts` | `src/components/admin/DashboardCharts.tsx:56` | yes |
| from | `posts` | `src/components/admin/ReportsTab.tsx:68` | yes |
| from | `posts` | `src/components/admin/ReportsTab.tsx:110` | yes |
| from | `posts` | `src/components/admin/ReportsTab.tsx:127` | yes |
| from | `posts` | `src/components/admin/StatsCards.tsx:13` | yes |
| from | `posts` | `src/components/admin/UsersTable.tsx:119` | yes |
| from | `posts` | `src/components/admin/UsersTable.tsx:801` | yes |
| from | `posts` | `src/components/admin/UsersTable.tsx:809` | yes |
| from | `posts` | `src/components/courses/DiscussionsTab.tsx:35` | yes |
| from | `posts` | `src/components/courses/DiscussionsTab.tsx:85` | yes |
| from | `posts` | `src/lib/notificationsStore.ts:164` | yes |
| from | `posts` | `src/routes/_authenticated/leaderboard.tsx:195` | yes |
| from | `posts` | `src/routes/_authenticated/leaderboard.tsx:298` | yes |
| from | `posts` | `src/routes/_authenticated/posts.$id.tsx:60` | yes |
| from | `posts` | `src/routes/_authenticated/posts.$id.tsx:74` | yes |
| from | `posts` | `src/routes/_authenticated/posts.$id.tsx:203` | yes |
| from | `posts` | `src/routes/_authenticated/profile.$id.tsx:142` | yes |
| from | `posts` | `src/routes/_authenticated/profile.$id.tsx:155` | yes |
| from | `profiles` | `src/components/BroadcastNotificationTab.tsx:145` | yes |
| from | `profiles` | `src/components/BroadcastNotificationTab.tsx:160` | yes |
| from | `profiles` | `src/components/PinnedEventCard.tsx:57` | yes |
| from | `profiles` | `src/components/PinnedEventCard.tsx:136` | yes |
| from | `profiles` | `src/components/ProfileCardFrame.tsx:106` | yes |
| from | `profiles` | `src/components/ProfileCardFrame.tsx:169` | yes |
| from | `profiles` | `src/components/ProfileCardFrame.tsx:247` | yes |
| from | `profiles` | `src/components/admin/ActivityLogTab.tsx:29` | yes |
| from | `profiles` | `src/components/admin/ActivityLogTab.tsx:70` | yes |
| from | `profiles` | `src/components/admin/ActivityLogTab.tsx:157` | yes |
| from | `profiles` | `src/components/admin/AdminSearch.tsx:31` | yes |
| from | `profiles` | `src/components/admin/CoursesManagementTab.tsx:44` | yes |
| from | `profiles` | `src/components/admin/DashboardCharts.tsx:20` | yes |
| from | `profiles` | `src/components/admin/DashboardCharts.tsx:21` | yes |
| from | `profiles` | `src/components/admin/DashboardCharts.tsx:35` | yes |
| from | `profiles` | `src/components/admin/QuickActions.tsx:28` | yes |
| from | `profiles` | `src/components/admin/ReportsTab.tsx:71` | yes |
| from | `profiles` | `src/components/admin/ReportsTab.tsx:117` | yes |
| from | `profiles` | `src/components/admin/ReportsTab.tsx:153` | yes |
| from | `profiles` | `src/components/admin/ReportsTab.tsx:373` | yes |
| from | `profiles` | `src/components/admin/StatsCards.tsx:12` | yes |
| from | `profiles` | `src/components/admin/SubAdminsTab.tsx:67` | yes |
| from | `profiles` | `src/components/admin/SubAdminsTab.tsx:174` | yes |
| from | `profiles` | `src/components/admin/SubAdminsTab.tsx:193` | yes |
| from | `profiles` | `src/components/admin/UsersTable.tsx:101` | yes |
| from | `profiles` | `src/components/admin/admin-shared.tsx:56` | yes |
| from | `profiles` | `src/components/courses/FilesTab.tsx:103` | yes |
| from | `profiles` | `src/hooks/useAuth.tsx:96` | yes |
| from | `profiles` | `src/hooks/useAuth.tsx:107` | yes |
| from | `profiles` | `src/hooks/useAuth.tsx:202` | yes |
| from | `profiles` | `src/lib/nameChangeRequests.ts:25` | yes |
| from | `profiles` | `src/lib/nameChangeRequests.ts:39` | yes |
| from | `profiles` | `src/lib/nameChangeRequests.ts:97` | yes |
| from | `profiles` | `src/lib/notificationsStore.ts:194` | yes |
| from | `profiles` | `src/lib/notificationsStore.ts:266` | yes |
| from | `profiles` | `src/lib/privacy.ts:8` | yes |
| from | `profiles` | `src/lib/privacy.ts:26` | yes |
| from | `profiles` | `src/lib/privacy.ts:37` | yes |
| from | `profiles` | `src/routes/_authenticated/change-password.tsx:33` | yes |
| from | `profiles` | `src/routes/_authenticated/complete-profile.tsx:79` | yes |
| from | `profiles` | `src/routes/_authenticated/courses.index.tsx:848` | yes |
| from | `profiles` | `src/routes/_authenticated/leaderboard.tsx:174` | yes |
| from | `profiles` | `src/routes/_authenticated/messages.$id.tsx:158` | yes |
| from | `profiles` | `src/routes/_authenticated/profile.$id.tsx:49` | yes |
| from | `profiles` | `src/routes/_authenticated/profile.$id.tsx:60` | yes |
| from | `profiles` | `src/routes/_authenticated/profile.$id.tsx:284` | yes |
| from | `profiles` | `src/routes/auth.tsx:70` | yes |
| from | `saved_posts` | `src/components/PostCard.tsx:191` | yes |
| from | `saved_posts` | `src/components/PostCard.tsx:194` | yes |
| from | `saved_posts` | `src/components/PostList.tsx:20` | yes |
| from | `saved_posts` | `src/components/PostList.tsx:66` | yes |
| from | `subadmin_permissions` | `src/components/admin/SubAdminsTab.tsx:102` | yes |
| from | `subadmin_permissions` | `src/components/admin/SubAdminsTab.tsx:200` | yes |
| from | `subadmin_permissions` | `src/components/admin/SubAdminsTab.tsx:290` | yes |
| from | `subadmin_permissions` | `src/hooks/useAuth.tsx:127` | yes |
| from | `subadmin_permissions` | `src/hooks/useAuth.tsx:208` | yes |
| from | `user_roles` | `src/components/admin/AddTeacherCard.tsx:71` | yes |
| from | `user_roles` | `src/components/admin/AddTeacherCard.tsx:76` | yes |
| from | `user_roles` | `src/components/admin/SubAdminsTab.tsx:59` | yes |
| from | `user_roles` | `src/components/admin/SubAdminsTab.tsx:93` | yes |
| from | `user_roles` | `src/components/admin/SubAdminsTab.tsx:94` | yes |
| from | `user_roles` | `src/components/admin/SubAdminsTab.tsx:229` | yes |
| from | `user_roles` | `src/components/admin/SubAdminsTab.tsx:234` | yes |
| from | `user_roles` | `src/components/admin/UsersTable.tsx:105` | yes |
| from | `user_roles` | `src/components/admin/UsersTable.tsx:180` | yes |
| from | `user_roles` | `src/components/admin/UsersTable.tsx:181` | yes |
| from | `user_roles` | `src/hooks/useAuth.tsx:97` | yes |
| from | `user_roles` | `src/routes/_authenticated/courses.$id.manage.tsx:90` | yes |
| from | `user_roles` | `src/routes/_authenticated/courses.index.tsx:805` | yes |
| from | `user_roles` | `src/routes/_authenticated/leaderboard.tsx:251` | yes |
| from | `user_roles` | `src/routes/_authenticated/profile.$id.tsx:81` | yes |
| from | `user_warnings` | `src/components/admin/UsersTable.tsx:815` | yes |
| from | `user_warnings` | `src/lib/notificationsStore.ts:295` | yes |
| rpc | `admin_adjust_points` | `src/components/admin/UsersTable.tsx:197` | yes |
| rpc | `admin_adjust_points` | `src/components/admin/UsersTable.tsx:840` | yes |
| rpc | `admin_ban` | `src/components/admin/ReportsTab.tsx:173` | yes |
| rpc | `admin_ban` | `src/components/admin/UsersTable.tsx:234` | yes |
| rpc | `admin_ban` | `src/components/admin/admin-shared.tsx:50` | yes |
| rpc | `admin_delete_user` | `src/components/admin/SubAdminsTab.tsx:265` | yes |
| rpc | `admin_delete_user` | `src/components/admin/UsersTable.tsx:305` | yes |
| rpc | `admin_set_teacher_role` | `src/components/admin/AddTeacherCard.tsx:61` | yes |
| rpc | `admin_set_user_role` | `src/components/admin/SubAdminsTab.tsx:91` | yes |
| rpc | `admin_set_user_role` | `src/components/admin/SubAdminsTab.tsx:218` | yes |
| rpc | `admin_set_verified` | `src/components/admin/UsersTable.tsx:284` | yes |
| rpc | `admin_set_year` | `src/components/admin/UsersTable.tsx:266` | yes |
| rpc | `admin_suspend` | `src/components/admin/ReportsTab.tsx:166` | yes |
| rpc | `admin_suspend` | `src/components/admin/UsersTable.tsx:212` | yes |
| rpc | `admin_unban` | `src/components/admin/UsersTable.tsx:252` | yes |
| rpc | `admin_warn` | `src/components/admin/ReportsTab.tsx:163` | yes |
| rpc | `admin_warn` | `src/components/admin/ReportsTab.tsx:403` | yes |
| rpc | `create_comment_as` | `src/routes/_authenticated/posts.$id.tsx:147` | yes |
| rpc | `create_dm` | `src/lib/chatUtils.ts:14` | yes |
| rpc | `create_group` | `src/components/NewConversationDialog.tsx:67` | yes |
| rpc | `create_post_as` | `src/components/CreatePost.tsx:107` | yes |
| rpc | `create_post_as` | `src/components/courses/DiscussionsTab.tsx:66` | yes |
| rpc | `delete_conversation` | `src/components/MessagesShell.tsx:97` | yes |
| rpc | `get_anonymous_authors` | `src/lib/anonymous.ts:31` | yes |
| rpc | `get_conversation_unread_counts` | `src/components/MessagesShell.tsx:72` | yes |
| rpc | `get_courses_with_counts` | `src/components/admin/CoursesManagementTab.tsx:38` | yes |
| rpc | `get_daily_posts` | `src/components/admin/DashboardCharts.tsx:50` | yes |
| rpc | `get_daily_user_registrations` | `src/components/admin/DashboardCharts.tsx:29` | yes |
| rpc | `get_leaderboard_profiles` | `src/routes/_authenticated/leaderboard.tsx:152` | yes |
| rpc | `get_public_profiles` | `src/components/GlobalSearchDialog.tsx:131` | yes |
| rpc | `get_public_profiles` | `src/components/GlobalSearchDialog.tsx:188` | yes |
| rpc | `get_public_profiles` | `src/components/GlobalSearchDialog.tsx:230` | yes |
| rpc | `get_public_profiles` | `src/components/MessagesShell.tsx:145` | yes |
| rpc | `get_public_profiles` | `src/components/PinnedEventCard.tsx:53` | yes |
| rpc | `get_public_profiles` | `src/components/PinnedEventCard.tsx:132` | yes |
| rpc | `get_public_profiles` | `src/components/PostList.tsx:54` | yes |
| rpc | `get_public_profiles` | `src/components/courses/DiscussionsTab.tsx:46` | yes |
| rpc | `get_public_profiles` | `src/components/courses/QuestionCard.tsx:55` | yes |
| rpc | `get_public_profiles` | `src/components/courses/UpdatesTab.tsx:55` | yes |
| rpc | `get_public_profiles` | `src/routes/_authenticated/courses.$id.manage.tsx:95` | yes |
| rpc | `get_public_profiles` | `src/routes/_authenticated/courses.$id.tsx:88` | yes |
| rpc | `get_public_profiles` | `src/routes/_authenticated/courses.index.tsx:148` | yes |
| rpc | `get_public_profiles` | `src/routes/_authenticated/courses.index.tsx:195` | yes |
| rpc | `get_public_profiles` | `src/routes/_authenticated/courses.index.tsx:812` | yes |
| rpc | `get_public_profiles` | `src/routes/_authenticated/leaderboard.tsx:215` | yes |
| rpc | `get_public_profiles` | `src/routes/_authenticated/messages.$id.tsx:153` | yes |
| rpc | `get_public_profiles` | `src/routes/_authenticated/posts.$id.tsx:76` | yes |
| rpc | `get_public_profiles` | `src/routes/_authenticated/posts.$id.tsx:97` | yes |
| rpc | `get_public_profiles` | `src/routes/_authenticated/profile.$id.tsx:55` | yes |
| rpc | `get_unread_message_count` | `src/components/AppLayout.tsx:68` | yes |
| rpc | `leave_conversation` | `src/components/MessagesShell.tsx:82` | yes |
| rpc | `leave_conversation` | `src/routes/_authenticated/messages.$id.tsx:232` | yes |
| rpc | `mark_conversation_read` | `src/routes/_authenticated/messages.$id.tsx:211` | yes |
| rpc | `search_public_profiles` | `src/components/GlobalSearchDialog.tsx:222` | yes |
| rpc | `search_public_profiles` | `src/components/NewConversationDialog.tsx:39` | yes |
| rpc | `search_public_profiles` | `src/components/RichTextEditor.tsx:43` | yes |
| rpc | `search_public_profiles` | `src/routes/_authenticated/leaderboard.tsx:198` | yes |
| rpc | `toggle_pinned_card_participation` | `src/lib/pinnedCardStore.ts:234` | yes |
| rpc | `vote_on_poll` | `src/lib/pinnedCardStore.ts:212` | yes |

## Appendix: Catalog column supplement (unfiltered by information_schema privileges)

```csv
relname,attnum,attname,type,attnotnull,default_value
admin_actions,1,id,uuid,t,gen_random_uuid()
admin_actions,2,admin_id,uuid,t,
admin_actions,3,target_user_id,uuid,f,
admin_actions,4,action,text,t,
admin_actions,5,details,jsonb,f,
admin_actions,6,created_at,timestamp with time zone,t,now()
anonymous_authors,1,content_type,text,t,
anonymous_authors,2,content_id,uuid,t,
anonymous_authors,3,author_id,uuid,t,
anonymous_authors,4,created_at,timestamp with time zone,t,now()
banned_words,1,id,uuid,t,gen_random_uuid()
banned_words,2,word,text,t,
banned_words,3,created_at,timestamp with time zone,t,now()
blocked_users,1,blocker_id,uuid,t,
blocked_users,2,blocked_id,uuid,t,
blocked_users,3,created_at,timestamp with time zone,t,now()
comments,1,id,uuid,t,gen_random_uuid()
comments,2,post_id,uuid,t,
comments,3,parent_id,uuid,f,
comments,4,author_id,uuid,f,
comments,5,content,text,t,
comments,6,created_at,timestamp with time zone,t,now()
comments,7,is_anonymous,boolean,t,false
conversation_members,1,conversation_id,uuid,t,
conversation_members,2,user_id,uuid,t,
conversation_members,3,joined_at,timestamp with time zone,t,now()
conversation_members,4,last_read_at,timestamp with time zone,f,now()
conversations,1,id,uuid,t,gen_random_uuid()
conversations,2,is_group,boolean,t,false
conversations,3,name,text,f,
conversations,4,created_by,uuid,f,
conversations,5,created_at,timestamp with time zone,t,now()
conversations,6,updated_at,timestamp with time zone,t,now()
course_links,1,id,uuid,t,gen_random_uuid()
course_links,2,course_id,uuid,t,
course_links,3,title,text,t,
course_links,4,url,text,t,
course_links,5,link_type,text,f,
course_links,6,created_by,uuid,f,
course_links,7,created_at,timestamp with time zone,t,now()
course_links,8,is_important,boolean,t,false
course_updates,1,id,uuid,t,gen_random_uuid()
course_updates,2,course_id,uuid,t,
course_updates,3,author_id,uuid,t,
course_updates,4,content,text,t,
course_updates,5,image_paths,text[],t,'{}'::text[]
course_updates,6,created_at,timestamp with time zone,t,now()
courses,1,id,uuid,t,gen_random_uuid()
courses,2,major,major_code,t,
courses,3,year,smallint,t,
courses,4,semester,smallint,t,
courses,5,name,text,t,
courses,6,description,text,f,
courses,7,teacher_id,uuid,f,
courses,8,created_by,uuid,f,
courses,9,created_at,timestamp with time zone,t,now()
courses,10,updated_at,timestamp with time zone,t,now()
courses,11,schedule,jsonb,f,
message_reports,1,id,uuid,t,gen_random_uuid()
message_reports,2,reporter_id,uuid,t,
message_reports,3,reported_user_id,uuid,t,
message_reports,4,conversation_id,uuid,f,
message_reports,5,reason,text,t,
message_reports,6,note,text,f,
message_reports,7,status,report_status,t,'pending'::report_status
message_reports,8,created_at,timestamp with time zone,t,now()
messages,1,id,uuid,t,gen_random_uuid()
messages,2,conversation_id,uuid,t,
messages,3,sender_id,uuid,t,
messages,4,content,text,t,
messages,5,created_at,timestamp with time zone,t,now()
notifications,1,id,text,t,"('notif_'::text || replace((gen_random_uuid())::text, '-'::text, ''::text))"
notifications,2,recipient_id,uuid,t,
notifications,3,actor_id,uuid,f,
notifications,4,actor_name,text,f,
notifications,5,actor_avatar,text,f,
notifications,6,type,text,t,'announcement'::text
notifications,7,priority,text,t,'normal'::text
notifications,8,title,text,t,
notifications,9,body,text,t,
notifications,10,link,text,f,
notifications,11,read,boolean,t,false
notifications,12,created_at,timestamp with time zone,t,now()
pinned_cards,1,id,text,t,
pinned_cards,2,enabled,boolean,t,true
pinned_cards,3,type,text,t,
pinned_cards,4,theme,text,t,
pinned_cards,5,badge_text,text,t,
pinned_cards,6,title,text,t,
pinned_cards,7,description,text,t,
pinned_cards,8,image_url,text,f,
pinned_cards,9,end_date,text,f,
pinned_cards,10,action_button_text,text,f,
pinned_cards,11,action_button_url,text,f,
pinned_cards,12,target_year,integer,f,
pinned_cards,13,target_major,text,f,
pinned_cards,14,poll_options,jsonb,t,'[]'::jsonb
pinned_cards,15,votes,jsonb,t,'{}'::jsonb
pinned_cards,16,participants,jsonb,t,'[]'::jsonb
pinned_cards,17,created_at,timestamp with time zone,t,"timezone('utc'::text, now())"
pinned_cards,18,updated_at,timestamp with time zone,t,"timezone('utc'::text, now())"
post_reactions,1,post_id,uuid,t,
post_reactions,2,user_id,uuid,t,
post_reactions,3,reaction,reaction_type,t,
post_reactions,4,created_at,timestamp with time zone,t,now()
post_reports,1,id,uuid,t,gen_random_uuid()
post_reports,2,post_id,uuid,t,
post_reports,3,reporter_id,uuid,t,
post_reports,4,reason,text,t,
post_reports,5,status,report_status,t,'pending'::report_status
post_reports,6,created_at,timestamp with time zone,t,now()
posts,1,id,uuid,t,gen_random_uuid()
posts,2,author_id,uuid,f,
posts,3,content,text,t,
posts,4,images,text[],f,
posts,5,created_at,timestamp with time zone,t,now()
posts,6,updated_at,timestamp with time zone,t,now()
posts,7,image_paths,text[],t,'{}'::text[]
posts,8,post_type,post_type,t,'general'::post_type
posts,9,accepted_answer_id,uuid,f,
posts,10,is_anonymous,boolean,t,false
profiles,1,id,uuid,t,
profiles,2,university_number,text,t,
profiles,3,full_name,text,t,
profiles,4,major,major_code,f,
profiles,5,year,smallint,f,
profiles,6,avatar_url,text,f,
profiles,7,bio,text,f,
profiles,8,must_change_password,boolean,t,true
profiles,9,created_at,timestamp with time zone,t,now()
profiles,10,updated_at,timestamp with time zone,t,now()
profiles,11,points,integer,t,0
profiles,12,email,text,f,
profiles,13,warning_count,integer,t,0
profiles,14,suspended_until,timestamp with time zone,f,
profiles,15,banned,boolean,t,false
profiles,16,verified,boolean,t,false
profiles,17,card_theme_id,text,f,'stars'::text
profiles,18,hide_university_number,boolean,f,false
profiles,19,theme,text,f,'stars'::text
saved_posts,1,user_id,uuid,t,
saved_posts,2,post_id,uuid,t,
saved_posts,3,created_at,timestamp with time zone,t,now()
subadmin_permissions,1,user_id,uuid,t,
subadmin_permissions,2,can_warn,boolean,t,true
subadmin_permissions,3,can_suspend,boolean,t,true
subadmin_permissions,4,can_courses,boolean,t,true
subadmin_permissions,5,can_reports,boolean,t,true
subadmin_permissions,6,can_words,boolean,t,true
subadmin_permissions,7,can_teachers,boolean,t,true
subadmin_permissions,8,created_at,timestamp with time zone,t,now()
user_roles,1,id,uuid,t,gen_random_uuid()
user_roles,2,user_id,uuid,t,
user_roles,3,role,app_role,t,
user_roles,4,created_at,timestamp with time zone,t,now()
user_warnings,1,id,uuid,t,gen_random_uuid()
user_warnings,2,user_id,uuid,t,
user_warnings,3,reason,text,t,
user_warnings,4,issued_by,uuid,f,
user_warnings,5,created_at,timestamp with time zone,t,now()
```

## Appendix: Effective table privileges supplement

```csv
relname,role,select_priv,insert_priv,update_priv,delete_priv
admin_actions,anon,t,t,t,t
admin_actions,authenticated,t,t,t,t
anonymous_authors,anon,t,t,t,t
anonymous_authors,authenticated,t,t,t,t
banned_words,anon,t,t,t,t
banned_words,authenticated,t,t,t,t
blocked_users,anon,t,t,t,t
blocked_users,authenticated,t,t,t,t
comments,anon,t,t,t,t
comments,authenticated,t,t,t,t
conversation_members,anon,t,t,t,t
conversation_members,authenticated,t,t,t,t
conversations,anon,t,t,t,t
conversations,authenticated,t,t,t,t
course_links,anon,t,t,t,t
course_links,authenticated,t,t,t,t
course_updates,anon,t,t,t,t
course_updates,authenticated,t,t,t,t
courses,anon,t,t,t,t
courses,authenticated,t,t,t,t
message_reports,anon,t,t,t,t
message_reports,authenticated,t,t,t,t
messages,anon,t,t,t,t
messages,authenticated,t,t,t,t
notifications,anon,t,t,t,t
notifications,authenticated,t,t,t,t
pinned_cards,anon,t,t,t,t
pinned_cards,authenticated,t,t,t,t
post_reactions,anon,t,t,t,t
post_reactions,authenticated,t,t,t,t
post_reports,anon,t,t,t,t
post_reports,authenticated,t,t,t,t
posts,anon,t,t,t,t
posts,authenticated,t,t,t,t
profiles,anon,t,t,t,t
profiles,authenticated,t,t,t,t
saved_posts,anon,t,t,t,t
saved_posts,authenticated,t,t,t,t
subadmin_permissions,anon,t,t,t,t
subadmin_permissions,authenticated,t,t,t,t
user_roles,anon,t,t,t,t
user_roles,authenticated,t,t,t,t
user_warnings,anon,t,t,t,t
user_warnings,authenticated,t,t,t,t
```

## Appendix: Effective EXECUTE privileges supplement

```csv
proname,pg_get_function_identity_arguments,proacl,anon_execute,authenticated_execute
admin_adjust_points,"_user uuid, _delta integer","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
admin_ban,"_user uuid, _reason text","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
admin_delete_user,_user uuid,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
admin_set_teacher_role,_user uuid,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
admin_set_user_role,"_user uuid, _role app_role","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
admin_set_verified,"_user uuid, _verified boolean","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
admin_set_year,"_user uuid, _year smallint","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
admin_suspend,"_user uuid, _days integer, _reason text","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
admin_unban,_user uuid,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
admin_warn,"_user uuid, _reason text","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
auto_verify_on_points,,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
award_points,"_user uuid, _delta integer","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
check_message_not_blocked,,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
compute_rank,_points integer,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
create_comment_as,"_post_id uuid, _content text, _parent_id uuid, _anonymous boolean","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
create_dm,_other uuid,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
create_group,"_name text, _members uuid[]","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
create_post_as,"_content text, _images text[], _post_type post_type, _anonymous boolean","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
delete_conversation,"_conv_id uuid, _user_id uuid","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
get_anonymous_authors,"_type text, _ids uuid[]","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
get_conversation_unread_counts,_user_id uuid,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
get_courses_with_counts,,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
get_daily_posts,since timestamp with time zone,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
get_daily_user_registrations,since timestamp with time zone,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
get_leaderboard_profiles,"_major major_code, _year smallint","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
get_public_profiles,_ids uuid[],"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
get_recent_admin_activity,,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
get_unread_message_count,_user_id uuid,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
handle_new_user,,"{postgres=X/postgres,service_role=X/postgres}",f,f
has_role,"_user_id uuid, _role app_role","{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",f,t
has_subadmin_permission,"_user_id uuid, _permission text","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
is_anonymous_owner,"_type text, _id uuid, _user uuid","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
is_conversation_member,"_conv uuid, _user uuid","{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",f,t
is_main_admin,_user_id uuid,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
leave_conversation,"_conv_id uuid, _user_id uuid","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
mark_conversation_read,"_conv_id uuid, _user_id uuid","{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
on_comment_insert_points,,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
on_post_insert_points,,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
on_reaction_insert_points,,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
on_report_confirmed,,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
protect_accepted_answer,,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
protect_pinned_card_columns,,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
protect_privileged_profile_columns,,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
search_public_profiles,_q text,"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",t,t
toggle_pinned_card_participation,p_user_id uuid,"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",f,t
update_updated_at_column,,"{postgres=X/postgres,service_role=X/postgres}",f,f
vote_on_poll,"p_user_id uuid, p_option_id text","{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",f,t
```

# Findings and feature audit

## Scope and confidence

Statuses below describe source/catalog compatibility, not a successful interactive production test. No user mutations, RPC execution, migrations, or project writes were performed. The complete catalog evidence is above. **Important:** `information_schema.routines`, columns, and grant views are privilege-filtered for the audit connection: empty grant results do NOT mean no grants. The unfiltered `pg_proc` definitions and catalog/effective-privilege supplements are authoritative. Both pinned interaction RPCs DO exist. (Evidence: `(DB appendix below):296`, `:304`, `:1135`, `:1200`, `:1653`, `:1819`, `:1869`.)

## High-priority findings

1. **Critical: signup metadata can select a privileged role.** `handle_new_user` casts `NEW.raw_user_meta_data->>'role'` to `app_role` and inserts it into `user_roles`; its auth.users INSERT trigger is installed. No allowlist restricting the role to student is present in that function. A caller-controlled signup role therefore has a source-level privilege-escalation path; exploit was not executed. Admin role then authorizes broad policies. Evidence: `(DB appendix below):801-826`, `:1291`, `:260`.
2. **Hardcoded main admin depends on mutable profile identity.** DB `is_main_admin(_user_id uuid)` checks `profiles.university_number = '2011099840'` OR lowercase email `khdrmamon@gmail.com`, without requiring an admin role. Profile self-update policy permits own-row writes; protection restores privileged fields including email but does not restore university_number. Thus university-number modification is a potential main-admin impersonation path, subject to any uniqueness constraint and identity already occupying that value; not exploitation-tested. UI additionally recognizes `HIDDEN_2011099840`, unlike DB. Evidence: `(DB appendix below):887-898`, `:254`, `:1065-1090`; `src/components/admin/admin-shared.tsx:74-85`.
3. **Targeting is saved but not enforced.** `target_year` and `target_major` persist, but `PinnedEventCard` never reads their mapped camelCase values. Its only early visibility gate is enabled/preview. RPCs check identity and poll-option validity but do not check target, enabled state, type, or deadline. Countdown expiration only removes countdown. Evidence: `src/lib/pinnedCardStore.ts:74-75,112-113`; `src/components/PinnedEventCard.tsx:200-245`; `(DB appendix below):1098-1196`.
4. **Clear-votes and clear-participants buttons cannot clear persistent data.** Handlers submit empty collections, but `updateConfig` overwrites them with latest values, and `savePinnedCardToDb` omits both columns entirely. Success toast can therefore lie. Reset-default only resets endDate, not defaults. Evidence: `src/components/PinnedCardAdminTab.tsx:64-109`; `src/lib/pinnedCardStore.ts:100-122,188-208`.
5. **Sub-admin permissions are inconsistent across UI and DB.** UI defaults all six to true and parses a bio string; auth hydration loads `subadmin_permissions`. DB helper defaults missing permission to false and does not itself check sub_admin role. Reports/banned-words RLS checks admin only, not corresponding delegated flags; several tabs are visible for assistants despite backend denial. Evidence: `src/hooks/useAuth.tsx:124-141,275-319`; `src/routes/_authenticated/admin.tsx:44-50`; `(DB appendix below):837-860,182,219-221,240-243`.
6. **Main-admin protection is largely a UI restriction.** The shared hook attempts to ban the acting assistant, signs out, and reloads when targeting the hardcoded identity. Direct RPC callers do not execute that hook. Admin mutations inspected do not generally protect the target identity. The fallback self-ban profile update is blocked/restored for non-admin callers by profile protection. Evidence: `src/components/admin/admin-shared.tsx:43-91`; `(DB appendix below):327-480,1065-1090`.

## Feature matrix

All features below live on `/admin` (`/_authenticated/admin` file route) unless stated otherwise. Route authorization is client-side redirect/loading/null rendering, not a server route guard; database policies/functions remain the actual boundary. Tabs hide reports/teachers/words using six flags; log/courses hide from sub-admins; assistants can still see pinned, broadcast, name requests, stats and users. Evidence: `src/routes/_authenticated/admin.tsx:24-52,85-190`.

### Dashboard stats, charts, recent activity — PARTIAL

Flow: opening admin reads counts for `profiles`, `posts`, pending `post_reports.status`, and `messages`; charts read `profiles.major,year,created_at` and `posts.created_at`, attempt `get_daily_user_registrations(since)` / `get_daily_posts(since)` then fall back to raw rows. Loading spinner exists for charts; errors in counts/raw reads become zero/empty, not an explicit failure. Trend strings (+41%/-50%) are hardcoded, not calculated. Recent activity uses `get_recent_admin_activity()` with raw-table fallback including nonexistent name requests. These are snapshot queries, not real-time subscriptions. User/message RLS means assistants cannot assume global counts. Evidence: `src/components/admin/StatsCards.tsx:6-59`; `src/components/admin/DashboardCharts.tsx:12-75`; `src/components/admin/RecentActivity.tsx:14-44`; `(DB appendix below):219-224,253,304`.

### Search and quick actions — PARTIAL / UI-ONLY

Search starts at two characters; reads `profiles(id,full_name,email,avatar_url)` and `courses(id,name,major)`, five each; failures silently resemble no results. Clicking user only navigates `/admin?tab=users`, does not pass selected user; admin Tabs use defaultValue and do not consume that URL search. QuickActions profile/history and teacher navigation work as links; broadcast shortcut is a “coming soon” toast, as is the page upgrade button. Evidence: `src/components/admin/AdminSearch.tsx:24-56,70-77`; `src/routes/_authenticated/admin.tsx:73-77,99`; `src/components/admin/QuickActions.tsx:8-39`.

### Users list/details/filtering — PARTIAL

Reads top 500 `profiles.*` ordered by points, `user_roles(user_id,role)`, latest activity from `posts(author_id,created_at)`, `comments(author_id,created_at)`, `messages(sender_id,created_at)`. Filters names/university/year/major/role/ban status locally; heuristically hides assistant-like accounts. Therefore not an exhaustive directory or reliable whole-system last activity. Most query errors are ignored and become empty results; initial spinner exists. Details read user posts/comments and warnings. Evidence: `src/components/admin/UsersTable.tsx:78-165,318-363,783-824`; `(DB appendix below):253,260-263`.

### Warn / suspend / ban / unban — PARTIAL

Flow uses reason/action dialogs and mutation toasts/invalidation. Exact RPCs: `admin_warn(_user uuid,_reason text)` (report flow), `admin_suspend(_user uuid,_days integer,_reason text)`, `admin_ban(_user uuid,_reason text)`, `admin_unban(_user uuid)`. DB requires main admin OR `can_warn`/`can_suspend`, not merely any admin role. UI treats non-sub-admin admins as authorized; ordinary admins without permission rows can thus fail these RPCs. Warn inserts `user_warnings(user_id,reason,issued_by)`, increments `profiles.warning_count`, auto-suspends seven days after count >=3, logs `admin_actions(admin_id,target_user_id,action,details)`; suspension/ban/unban update `profiles.suspended_until,banned` and log actions. Evidence: `src/components/admin/UsersTable.tsx:203-259`; `src/components/admin/ReportsTab.tsx:148-176`; `(DB appendix below):327-480`.

### Delete / adjust points / verify / set year / set role — PARTIAL

`admin_delete_user(_user uuid)`, `admin_adjust_points(_user uuid,_delta integer)`, `admin_set_verified(_user uuid,_verified boolean)` require DB role admin, not sub_admin. UI explicitly refuses assistants for those operations, so this restriction currently agrees with UsersTable, but differs from generic delegated-admin expectations. Points update `profiles.points,rank`; verification updates `profiles.verified`; deletion targets auth.users; audit writes use `admin_actions`. `admin_set_year(_user uuid,_year smallint)` accepts main/admin/sub_admin, updates `profiles.year`, with UI errors surfaced. UsersTable toggles admin by direct `user_roles` insert/delete (admin-all RLS), rather than main-only `admin_set_user_role(_user uuid,_role app_role)`; errors from those direct mutations are not checked before success. Thus any role-admin can grant/revoke admin even though the role RPC is main-only. Evidence: `src/components/admin/UsersTable.tsx:174-201,262-316`; `(DB appendix below):309-324,341-350,374-429,260`.

### Sub-admins and six permissions — PARTIAL

Main-admin-only tab in UI. Flow creates isolated auth signup `${cleanId}@subadmin.edu` / `sub_${cleanId}`, waits for profile trigger, sets verified, upserts `subadmin_permissions(user_id,can_warn,can_suspend,can_courses,can_reports,can_words,can_teachers)`, assigns role; deletion uses admin RPC. Signup/profile/permission/role writes are nontransactional and may leave partial accounts. List heuristically identifies accounts by name/email/university and auto-heals missing sub_admin role during a read query; broad heuristics can promote misidentified accounts. Supabase returned error objects do not enter catch-only fallbacks automatically. Permission table writes are main-admin RLS enforced; missing UI permission defaults true while DB defaults false. Courses tab is hidden from every assistant despite `can_courses`. Evidence: `src/components/admin/SubAdminsTab.tsx:37-111,116-252`; `src/hooks/useAuth.tsx:275-319`; `src/routes/_authenticated/admin.tsx:131-137`; `(DB appendix below):256-259,837-860`.

### Teachers — PARTIAL

Flow validates required name/university/email/password, creates isolated auth signup metadata with must_change_password, then sets role via `admin_set_teacher_role(_user uuid)` (main OR can_teachers), with direct user_roles fallback and sets profile must_change_password. Errors toast; success clears form. No rollback if later steps fail. Assistant profile updates/role fallback encounter admin-only policies or protection; teacher RPC and profile writes must not be treated as one atomic successful provisioning. Evidence: `src/components/admin/AddTeacherCard.tsx:15-111`; `(DB appendix below):352-373,254,260,1065-1090`.

### Post and message reports — PARTIAL

Post list reads last 100 `post_reports.*`, joins `posts(id,content,author_id)` and reporter `profiles(id,full_name)`; dismiss sets status=dismissed; delete removes post then sets confirmed; warn/suspend/ban call RPC and confirm. Writes are not atomic and confirmation errors are not consistently checked. Confirmed-status trigger deducts 20 points via author lookup, which may no longer find a post after deletion. Message list reads `message_reports.*`, joins reporter/reported_user_id profiles; dismiss and warn/confirm exist, but warn flow ignores both response errors. Spinner/empty render paths cannot distinguish swallowed DB failures. Reports read/update RLS grants role admin (plus own-report reads), not can_reports; assistants see incomplete/self-only lists and denied updates. Evidence: `src/components/admin/ReportsTab.tsx:40-180,351-411`; `(DB appendix below):219-221,240-243,951-968`.

### Banned words — PARTIAL

Flow lists `banned_words.*`, inserts `word`, deletes by `id`, invalidates cache. UI can_words only controls tab visibility; DB ALL policy requires admin, so delegated assistants cannot manage. Initial read can silently be empty; duplicate/insert error shows toast. Evidence: `src/components/admin/BannedWordsTab.tsx:11-48`; `(DB appendix below):182`.

### Activity log — PARTIAL

Admin-only visible tab; reads `admin_actions.*` descending created_at limit 200 with profile joins, and academic posts/comments activity separately. Data is bounded, not complete history; errors can look empty. DB admin_actions SELECT is admin-only; action writes depend on individual mutation paths, so direct user_roles changes are not necessarily logged by UI. Evidence: `src/components/admin/ActivityLogTab.tsx:24-75,137-173`; `(DB appendix below):179-180`; `src/components/admin/UsersTable.tsx:174-192`.

### Courses management and CSV export — PARTIAL

Courses tab hidden from assistants regardless of can_courses; reads `get_courses_with_counts()` or `courses(id,name,major,year,teacher_id,created_at)` fallback with related counts/profile info; supports search/filter/navigation and CSV. Export builds browser Blob/BOM CSV, quotes embedded quotes, downloads and revokes URL; empty rows cause no download. It does not neutralize spreadsheet formula prefixes, so exported untrusted text can be interpreted as formula. It exports loaded client data, not a privileged server-side full dataset. Evidence: `src/components/admin/CoursesManagementTab.tsx:29-105`; `src/lib/exportCsv.ts:1-17`; `src/routes/_authenticated/admin.tsx:131-137`.

### Announcements/broadcast — PARTIAL

Broadcast tab supports title/body/link/priority/type, all/year/major/selected-user recipient targeting using `profiles.id` filters; excludes sender/currentUserId and inserts one `notifications` row per recipient: `recipient_id,actor_id,actor_name,actor_avatar,type,priority,title,body,link`. Returns inserted count or throws; empty-recipient/validation/error/success toasts exist. Native notification dispatch runs in sender browser, not proof of remote push delivery. History reads notifications and edits/deletes by row id, not a single atomic broadcast entity. Admin/sub_admin insert RLS exists, but history is recipient-scoped/admin-visible depending on policies; edits lack a broad admin update policy, and only admin can globally delete. Thus sending and history editing/deleting have different authorities. Non-DB activity notification read/dismiss state is localStorage-only, not broadcast persistence. Evidence: `src/components/BroadcastNotificationTab.tsx:140-231,246-289`; `src/lib/notificationsStore.ts:51-123,418-460`; `(DB appendix below):225-230`.

### Name change requests — BROKEN

Tab reads/filters requests and approve/reject handlers; `name_change_requests` does not exist in live pg_class, and `profiles.has_used_direct_name_change` is absent from catalog columns. Read helper swallows errors into [], making failure look like no requests. Intended columns: `id,user_id,current_name,requested_name,reason,contact_info,university_number,status,created_at,processed_at`. Approval first marks request approved then updates profiles.full_name; profile failure only warns, so even with table restored it is nontransactional and can falsely approve. Direct-change flag errors are ignored. No request-table DB policy exists because table is missing. Evidence: `src/lib/nameChangeRequests.ts:8-54,79-134`; `src/components/admin/NameRequestsTab.tsx:25-104`; `(DB appendix below):1653-1817`.

### Pinned card settings / preview — PARTIAL

Admin tab edits singleton `pinned_cards.id='pinned_featured_event_1'`; types poll/contest/event/announcement, themes, text, image URL, end date, action text/URL, options, enabled, target year/major. Mapping exact columns: `id,enabled,type,theme,badge_text,title,description,image_url,end_date,action_button_text,action_button_url,target_year,target_major,poll_options,votes,participants,created_at,updated_at`. Save UPDATE+SELECT single requires existing row (no upsert); missing/read-denied row silently returns disabled DEFAULT config; save throws and shows toast. Empty description maps null despite DB NOT NULL. Preview is non-sync local form. All admin/sub_admin roles can configure without granular permission. No image-upload storage path here, only URLs. Evidence: `src/lib/pinnedCardStore.ts:13-132`; `src/components/PinnedCardAdminTab.tsx:38-109,243`; `(DB appendix below):94-111,231-237`.

### Poll voting / event-contest participation — PARTIAL

Feed mounts `PinnedEventCard`; preview bypasses disabled visibility. Vote calls existing `vote_on_poll(p_user_id uuid,p_option_id text)`; DB locks singleton row, validates auth.uid matches supplied user, checks option id and returns updated votes. Participation calls existing `toggle_pinned_card_participation(p_user_id uuid)`; DB validates auth identity and atomically toggles JSONB participant list. Neither enforces target/deadline/type/enabled. Poll fallback on ANY RPC error optimistically sets state and attempts direct whole-votes UPDATE, ignores UPDATE error, risks stale-map conflict and false success. UI calls participation without error feedback. DB authenticated UPDATE policy is broad but trigger restricts non-admin edits to own interaction and immutable settings; direct-vote fallback can bypass RPC option validation. Admin/sub_admin bypass trigger restrictions. Evidence: `src/routes/_authenticated/feed.tsx:38`; `src/components/PinnedEventCard.tsx:509-519,600-609`; `src/lib/pinnedCardStore.ts:211-241`; `(DB appendix below):237,999-1064,1098-1196`.

### Pinned cache / realtime — PARTIAL

DB remains primary; localStorage `unihub_pinned_featured_card_v1` is a cross-tab cache, not exclusively local persistence. Storage handler does not filter storage key and can restore cached values on unrelated storage changes. Subscriber watches pinned_cards but that table is absent from realtime publication: cross-device updates are therefore not supported by the captured publication contract. Deletions also are not handled because callback requires payload.new matching id. Evidence: `src/lib/pinnedCardStore.ts:132-185`; `(DB appendix below):1353-1368`.

## Full frontend missing-object reconciliation

Literal `.from()` / `.rpc()` occurrences with source:line are inventoried above. **Missing public table:** `name_change_requests` (RecentActivity and nameChangeRequests helper). **No missing literal public RPCs** after checking unfiltered pg_proc: `vote_on_poll` and `toggle_pinned_card_participation` exist despite omission from the audit role's information_schema.routines. `course-files` is a storage bucket, not a missing public table. Bucket existence/limits/policies are captured separately. Dynamic table names are not proved complete by a literal grep; this appendix explicitly records literal frontend calls, including cast RPC calls. Evidence: `(DB appendix below):1318-1351,1370-1651,1869`; `src/components/courses/FilesTab.tsx:85,144`.

## Recommended changes (not applied)

- In `handle_new_user` role assignment (catalog definition above), replace metadata-derived role initialization with `v_role := 'student'::public.app_role;`; grant elevated roles only through verified administrative operations. Validate any signup metadata identity separately.
- Replace `is_main_admin` profile-text identity comparison with an immutable allowlisted auth UUID; restrict privileged profile identity updates in DB.
- Make DB permission checks consistent: role membership AND explicit delegated permission; decide ordinary-admin authority consistently. Use identical helpers for UI and RLS rather than relying on hidden tabs.
- Add a transactional name-change schema and approval RPC before advertising the tab; propagate errors instead of empty arrays.
- Enforce card audience/status/expiry/type in DB interaction functions and frontend visibility. Provide dedicated admin clear/reset RPCs and check all fallback mutation responses. Add pinned_cards to intended realtime publication if cross-device live updates are required.
- Use a server-controlled provisioning operation for teacher/assistant creation with rollback/cleanup and explicit role assignment, not heuristics during list reads.
- Neutralize formula-prefixed cells before CSV creation. Surface permission and network failures distinctly from legitimate empty lists/counts.

These are proposed remediation directions, not edits or tested patches. Exact project replacements should be designed after resolving authorization semantics and missing-schema requirements; no speculative migration was executed.
