# NEXUS Android 1.0.0

Native Kotlin + Jetpack Compose client for the existing NEXUS student platform.

## Scope
- Android only; student accounts only.
- Reuses current Supabase Auth and PostgREST/Storage APIs.
- No WebView wrapper and no local copy of the academic database.
- Course catalog, course files, external links, announcements, schedules, course questions and replies.
- Light, dark and system appearance.
- Existing website sign-in can hand off its Supabase session through the com.nexus.app://login-callback deep link.

## Backend contract
- Uses the same Supabase URL and publishable key as the website.
- University number login maps to number@college.edu, matching universityNumberToEmail in the web project.
- The app checks user_roles and refuses non-student accounts.
- Student profile, courses, course_links, course_updates, posts, comments and get_public_profiles use the existing schema and RLS.
- Course file URLs are short-lived signed links from the private course-files bucket.
- No service-role key is included. The publishable key is a public client key; Supabase RLS remains the authorization boundary.

## Architecture
- data/NexusRepository.kt: Supabase Auth, REST, RPC and Storage.
- data/SecureSessionStore.kt: AES-GCM session storage backed by Android Keystore.
- NexusViewModel.kt: screen state and asynchronous operations.
- ui/NexusApp.kt: native Compose screens and interactions.
- ui/theme/Theme.kt: NEXUS visual tokens.

## Build
From the android directory:
- gradle testDebugUnitTest
- gradle assembleDebug

GitHub Actions builds and uploads app-debug.apk as the NEXUS-Android-v1.0.0 artifact.
