# NEXUS redesign and parity specification

Date: 2026-11-14
Baseline branch: `fix/android-v1.2.1`
Target: a complete, consistent NEXUS web + Android experience, not a recolor.

## Evidence-based baseline

### Android 1.2.1 artifact
- Retrieved the actual GitHub Actions artifact from run 43368676248 (13 Nov 2026).
- Artifact contains `app-debug.apk`, 17,394,026 bytes; package `com.nexus.app`; version code 121 / version name 1.2.1.
- GitHub Actions reports the unit-test and APK-assembly steps succeeded.
- The test source tree currently contains one test file with five test methods. This is not adequate coverage for the app's critical journeys.
- The current APK was installed on an Android emulator and its login screen was inspected.

### Current Android source findings
- `AppScreen` currently defines only LOGIN, HOME, FEED, COURSES, COURSE_DETAIL, PROFILE, and CHANGE_PASSWORD.
- `SplashScreen()` renders the brand plus a small CircularProgressIndicator. It is not the legacy animated intro the user wants.
- `ProfileScreen()` renders name, university number, major/year, app light/dark/system mode, change-password, and sign-out. It does not implement the full profile experience, rank card, card-theme selector, contribution history, achievement collection, or the richer profile interactions present in the product.
- `NexusApp.kt` is a large monolithic UI file (~55 KB); feature components and states need clearer boundaries.
- `SocialScreens.kt` contains a minimal text-first feed and comment count. The Android UI does not yet match the website's richer post model and interaction surface.
- `NexusViewModel.kt` uses a shared loading flag for multiple screens and reloads the full feed after publishing or commenting.
- `NexusRepository.loadFeed()` performs serial requests for posts, author profiles, and comment counts. Home and course-detail loading also perform multiple serial requests. This is a credible source of perceived waiting, but must be confirmed with measurements before and after changes.
- `NexusRepository` uses 20-second connect and 30-second read timeouts. UI should not leave users staring at a blocking spinner while those requests run.

### Legacy APK findings
- The user-provided `kryptonite-khdr.apk` is a separate legacy reference build, package `com.nexus.app`, approximately 28.5 MB.
- Its compiled classes include dedicated implementations for splash, profile, home, feed, courses, course detail, post creation/detail/card, search, saved posts, leaderboard, messages, notifications, admin, admin tabs, rich post text, pinned event cards, and a wallpaper manager.
- The legacy binary also contains a profile wallpaper dialog and a pinned-card theme component. This supports the user's statement that the older app had a richer feature surface.
- Use the legacy splash and feature ideas as references. Do not assume its compiled code is the correct current implementation or copy its backend behavior blindly.

### Website findings
- `src/lib/profileCardThemes.ts` defines five point-gated themes: stars (0), clouds (100), moon (300), sun (700), galaxy (1500).
- `ProfileCardFrame.tsx` currently uses gradient backgrounds and emoji/CSS decoration. It writes `profiles.theme` through an untyped cast and also falls back to localStorage; the database types expose `card_theme_id`. This mismatch must be resolved against the real schema before implementation.
- The profile route already includes contribution history, posts/comments/accepted-answer counts, streaks, and a 52-week activity heatmap. These are useful existing product concepts to preserve and align with Android.
- The admin route includes a broad tab surface, but at least one "ترقية للنظام الاحترافي" action only displays "قريباً". Every admin control must be traced to a real operation, permission, and result state.
- The existing parity audit identifies additional live-DB gaps around profile updates, OTP recovery, notifications, admin permissions, and private conversations. Treat the audit as a starting point and revalidate each item against current code and policies.

## Design direction

Create a distinctive academic-social product identity:
- A restrained, editorial visual language rather than generic AI dashboard patterns.
- A small semantic color system with light/dark modes; no arbitrary per-screen colors.
- Purposeful Arabic typography, carefully tuned line-height and weights, and consistent numeric typography.
- A measured spacing and shape scale; cards should have hierarchy, not all share the same rounded rectangle.
- Real, properly licensed photographic/illustrative assets for profile themes where they add meaning. Combine them with deliberate overlays, typography, rank insignia, and restrained motion; do not use emoji as the primary visual identity.
- Rank themes must differ in art direction and treatment, not only color. Unlocking and selection must be consistent between web and Android and enforced by trusted data rules.
- Motion should be short, intentional, interruptible, and respect reduced-motion preferences on web and system animation settings on Android.
- All screens must be designed in RTL first, including long text, tags, dialogs, bottom navigation, and mixed Arabic/Latin labels.

## Feature parity inventory to implement and verify

1. Authentication: login, Google/web OAuth handoff, registration, password recovery, deep-link return, validation, loading/error states.
2. Main feed: text, images, long-post expansion, tags, mentions, reactions, comments, post details, anonymous posting, save, report, polls, pinned content, pagination.
3. Navigation: stable selected state, back behavior, deep links, preserved scroll/state, notifications and messages entry points.
4. Profile: avatar, cover/theme, bio, identity/privacy, points, rank, progress to next rank, badges, contributions, streak, activity heatmap, posts, saved content, edit flows, name-change request, sharing, messaging.
5. Leaderboards: ranking logic, filters, categories, periods, tie behavior, privacy, empty/loading/error states.
6. Courses: course list/search/filters, detail tabs, files/links, schedule, updates, discussions, questions, replies, teacher identity.
7. Messaging and notifications: conversation list, unread state, secure message access, notification preferences, real server delivery.
8. Admin website: dashboard metrics/charts, users, roles, sub-admin scopes, teachers, courses, reports, activity log, banned words, name requests, pinned card/events, broadcast notifications, and every action's real server result.
9. Admin security: server-side role checks, RLS, private-data isolation, auditability, and safe defaults.
10. Quality: accessibility, offline/poor-network behavior, image loading, caching, pagination, performance budgets, crash/error reporting, and regression tests.

## Performance acceptance

Measure before changing code, then measure again on the same device and journey:
- cold launch to first meaningful screen
- session restoration
- feed first content and scroll smoothness
- profile open
- course list and course detail
- image decode/load behavior
- navigation response and back behavior

Prefer incremental content over blocking the whole page. Use skeletons only when they communicate the actual content layout; retain useful cached content during refresh. Do not add artificial splash delays.

## AI-assisted engineering process

Use the workflow recommended across the official Codex, Anthropic, and VS Code agent guidance:
1. Explore and map relevant files/data/tests.
2. Plan the change and define acceptance criteria.
3. Implement a bounded slice with explicit non-goals.
4. Add/update tests before claiming completion.
5. Run build, tests, static checks, and emulator journeys.
6. Review the diff independently for regressions and security issues.
7. Record evidence and only then proceed to the next slice.

Do not send a one-shot prompt to rewrite the entire app. Keep work small enough to inspect, test, and roll back safely.


## Gamification design constraints
- Preserve the selected hybrid leaderboard direction: macro ranking plus micro ranking by major, cohort/section, course, and period.
- Include a personal progress view and "nearby rank" so the global leaderboard is not the only feedback loop.
- Make point-award rules visible and tied to meaningful participation or academic contribution.
- Do not award points solely for post volume, repetitive comments, or other easy-to-game activity.
- Allow a student to choose any unlocked theme without falsifying their earned rank; selected appearance and actual rank are separate concepts.
- Do not claim the system is cheat-resistant until the server validates awards and theme unlocks.
