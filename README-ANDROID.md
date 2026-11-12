# NEXUS Android 1.2.0

Native Kotlin + Jetpack Compose client for the existing NEXUS student platform.

## Included in 1.2.0
- Android-native student community feed backed by the existing Supabase `posts` and `comments` tables.
- Public and anonymous student posts through the existing `create_post_as` RPC.
- Comments through the existing `create_comment_as` RPC.
- Existing course catalog, files, links, course discussions, updates and schedules retained.
- Student-only account enforcement and encrypted session storage backed by Android Keystore.
- Light, dark and system appearance retained.

## Backend and safety
- Reuses the existing Supabase Auth, PostgREST, RPC and Storage APIs.
- No database migrations or destructive data operations are performed by this release.
- No service-role key is included in the Android client.
- Access remains enforced by Supabase RLS and the student role check.

## Build
From `android`: `gradle testDebugUnitTest` then `gradle assembleDebug`.
GitHub Actions runs the same tests and publishes a debug-signed APK for device testing.
