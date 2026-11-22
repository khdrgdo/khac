# Toolchain baseline — NEXUS Android 1.0.0

**قرار التوافق بعد اختبارات SDK Manager وAAR metadata — 23 نوفمبر 2026.**

- `compileSdk = 36`, `targetSdk = 36`, `minSdk = 26`. نبقى على منصة SDK مستقرة متاحة في GitHub Actions.
- Compose BOM `2026.05.01`, Activity Compose `1.12.2`, Lifecycle `2.10.0`, Navigation 3 `1.2.1`.
- Compose BOM 2026.06 وما بعده يرفع Lifecycle إلى 2.11.x، وAAR metadata لذلك الإصدار يطلب compileSdk 37. محاولة تثبيت `platforms;android-37` فشلت حتى مع SDK preview channel 3؛ لذلك لن نستخدم منصة غير متاحة أو نتجاوز فحص AAR قسراً.
- هذا هو أحدث خط اعتمادية متوافق مع API 36 في هذا البناء، وليس ادعاءً بأنه أحدث إصدار AndroidX مطلقاً. سنرفع إلى API 37 بعد توفر حزمة SDK رسمية قابلة للتثبيت واجتياز CI.
- Android Gradle Plugin 9.5.2، Gradle 9.6.0، JDK 17، Kotlin 2.4.21.
- Supabase Kotlin 3.9.0، Ktor 3.4.3.

المراجع:
- [Compose BOM mapping](https://developer.android.com/develop/ui/compose/bom/bom-mapping)
- [Lifecycle release notes](https://developer.android.com/jetpack/androidx/releases/lifecycle)
- [Navigation 3 release notes](https://developer.android.com/jetpack/androidx/releases/navigation3)
