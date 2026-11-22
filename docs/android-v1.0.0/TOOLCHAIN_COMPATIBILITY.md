# Toolchain compatibility note — Android 1.0.0

**قرار CI بعد مراجعة AAR metadata وكتالوج Google Maven (23 نوفمبر 2026):**

- Compose 1.12.0 وما بعده يتطلب compileSdk 37 بحسب Android Developers. منصة API 37 في runner الحالي ما زالت Preview؛ لا نعتمدها لإصدار الإنتاج.
- Android Developers توصي حالياً بـ Compose BOM 2026.06.00. نثبتها مع compileSdk 36؛ لا نستخدم BOM 2026.07.00 لأنها غير موجودة في Google Maven وقت التحقق.
- Navigation 3.1.2 (1.2.2) stable. إصدار 1.2.1 خفّض متطلب compileSdk إلى 36، و1.2.2 إصلاح لاحق؛ لذلك نعتمد 1.2.2 مع API 36.
- compileSdk = 36 وtargetSdk = 36؛ minSdk = 26.
- AGP = 9.5.2، Gradle Wrapper = 9.6.0، JDK = 17، Kotlin = 2.4.21.
- تعطيل Gradle configuration cache مؤقتاً؛ أظهر AGP task processDebugNavigationResources مشكلة serialization في CI، ولم يكن ذلك سبب فشل dependency resolution لكنه يضيف ضجيجاً غير مفيد حتى يُحل.

عند صدور API 37 كمنصة stable وتوافق Compose 1.12+ معها، نرفع compileSdk وBOM بعد CI واختبارات الجهاز.

المراجع الرسمية:
- Compose setup/dependencies: https://developer.android.com/develop/ui/compose/setup-compose-dependencies-and-compiler
- Navigation 3 release notes: https://developer.android.com/jetpack/androidx/releases/navigation3
