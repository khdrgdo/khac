# Toolchain baseline — NEXUS Android 1.0.0

**Verified 23 November 2026 against Android Developers and the CI dependency graph.**

- Compose BOM 2026.09.00 is the latest stable BOM shown by the official Compose setup page. The official setup page states Compose 1.12+ requires compileSdk 37 and AGP 9.
- Lifecycle 2.11.0 is the stable release line used by the current Compose integration; its AAR metadata requires compileSdk 37.
- The GitHub runner's default SDK channel does not list `platforms;android-37`. The package is exposed through the SDK preview channel, so CI requests it with `sdkmanager --channel=3`. This is a compile-time platform dependency, not permission to target preview behavior.
- `compileSdk = 37`; `targetSdk = 36` for the first rollout; `minSdk = 26`. We do not target API 37 until its platform is stable and device behavior is validated.
- Android Gradle Plugin 9.5.2, Gradle 9.6.0, JDK 17, Kotlin 2.4.21.
- Compose BOM 2026.09.00, Activity Compose 1.13.0, Lifecycle 2.11.0, Navigation 3 1.2.2.
- Supabase Kotlin 3.9.0; Ktor 3.4.3.

Official references:
- Compose setup and compileSdk requirements: https://developer.android.com/develop/ui/compose/setup-compose-dependencies-and-compiler
- Compose BOM: https://developer.android.com/develop/ui/compose/bom
- Lifecycle releases: https://developer.android.com/jetpack/androidx/releases/lifecycle
- Navigation 3 releases: https://developer.android.com/jetpack/androidx/releases/navigation3
