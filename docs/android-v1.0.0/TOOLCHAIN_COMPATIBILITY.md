# Toolchain baseline — NEXUS Android 1.0.0

**Verified 23 November 2026 against Android Developers and the CI dependency graph.**

- Android 17 / API 37 is stable (released 16 June 2026). The previous API-36-only assumption was outdated.
- `compileSdk = 37`; `targetSdk = 36` for the first 1.0.0 rollout so compile-time access to API 37 does not opt the app into API-37 target behavior prematurely; `minSdk = 26`.
- Android Gradle Plugin 9.5.2 with Gradle 9.6.0 and JDK 17. AGP 9.5 supports API 37.
- Compose BOM 2026.09.00, the latest version shown by the official Compose setup page at verification time.
- Activity Compose 1.13.0; Lifecycle 2.11.0; Navigation 3 1.2.2.
- Supabase Kotlin 3.9.0; Ktor 3.4.3; Kotlin 2.4.21.
- The CI dependencyInsight run proved Compose BOM 2026.06.00 resolves Compose 1.11.3 and Lifecycle 2.11.0; Lifecycle 2.11.0 requires compileSdk 37. We now compile against the correct stable API instead of forcing older libraries.

Official references:
- Android 17 release: https://android-developers.googleblog.com/2026/06/Android-17.html
- Compose dependency setup and latest BOM: https://developer.android.com/develop/ui/compose/setup-compose-dependencies-and-compiler
- AGP 9.5 compatibility (API 37): https://developer.android.com/build/releases/agp-9-5-0-release-notes
- Navigation 3 releases: https://developer.android.com/jetpack/androidx/releases/navigation3
- Lifecycle releases: https://developer.android.com/jetpack/androidx/releases/lifecycle
