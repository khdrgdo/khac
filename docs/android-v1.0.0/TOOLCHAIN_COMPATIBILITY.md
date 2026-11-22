# Toolchain compatibility note — Android 1.0.0

**قرار CI بعد مراجعة AAR metadata وكتالوج Google Maven (23 نوفمبر 2026):**

- Compose 1.12.0 وما بعده يتطلب compileSdk 37 بحسب Android Developers. منصة API 37 في runner الحالي ما زالت Preview؛ لا نعتمدها لإصدار الإنتاج.
- Android Developers توصي حالياً بـ Compose BOM 2026.06.00. نثبتها مع compileSdk 36؛ BOM 2026.07.00 غير موجود في Google Maven وقت التحقق.
- Navigation 3 version 1.2.2 stable؛ إصدار 1.2.1 خفّض متطلب compileSdk إلى 36، و1.2.2 إصلاح لاحق.
- Lifecycle 2.10.0 هو خط التوافق المختار مع API 36؛ 2.11.1 يطلب compileSdk 37 في AAR metadata.
- compileSdk = 36 وtargetSdk = 36؛ minSdk = 26.
- AGP = 9.5.2، Gradle Wrapper = 9.6.0، JDK = 17، Kotlin = 2.4.21.
- تعطيل Gradle configuration cache مؤقتاً؛ أظهر AGP task processDebugNavigationResources مشكلة serialization في CI.

عند صدور API 37 كمنصة stable وتوافق Compose 1.12+ وLifecycle 2.11+ معها، نرفع compileSdk وBOM بعد CI واختبارات الجهاز.

المراجع الرسمية:
- Compose setup/dependencies: https://developer.android.com/develop/ui/compose/setup-compose-dependencies-and-compiler
- Navigation 3 release notes: https://developer.android.com/jetpack/androidx/releases/navigation3
- Lifecycle release notes: https://developer.android.com/jetpack/androidx/releases/lifecycle
