# Toolchain compatibility note — Android 1.0.0

**قرار CI بعد مراجعة AAR metadata وكتالوج Google Maven (23 نوفمبر 2026):**

- Compose 1.12.0 وما بعده يتطلب compileSdk 37 بحسب Android Developers؛ لذلك نثبت Compose BOM 2026.06.00 مع compileSdk 36.
- Navigation 3 version 1.2.1 هو خط التوافق المختار مع API 36. الإصدار 1.2.2 جرّ في CI Lifecycle 2.11.0 الذي يطلب compileSdk 37.
- Lifecycle 2.10.0؛ الإصدار 2.11.x غير مناسب لخط API 36 الحالي.
- Activity Compose 1.13.0، compileSdk = 36، targetSdk = 36، minSdk = 26.
- AGP = 9.5.2، Gradle Wrapper = 9.6.0، JDK = 17، Kotlin = 2.4.21.
- تعطيل Gradle configuration cache مؤقتاً بسبب مشكلة serialization في مهمة processDebugNavigationResources.

هذا اختيار توافق مثبت بالـ AAR metadata، وليس خفضاً عشوائياً للإصدارات. عند اعتماد API 37 stable، نرفع Compose وNavigation3 وLifecycle معاً بعد CI واختبارات الجهاز.

المراجع الرسمية:
- Compose setup/dependencies: https://developer.android.com/develop/ui/compose/setup-compose-dependencies-and-compiler
- Navigation 3 release notes: https://developer.android.com/jetpack/androidx/releases/navigation3
- Lifecycle release notes: https://developer.android.com/jetpack/androidx/releases/lifecycle
