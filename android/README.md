# NEXUS Android

تطبيق Android أصلي للمشروع NEXUS. المشروع يبدأ داخل هذا المجلد ولا يستبدل موقع TypeScript الحالي.

## متطلبات البناء

- JDK 17
- Gradle Wrapper 9.6.0
- Android SDK Platform 36 وBuild Tools 36.0.0
- Android minSdk 26

نستخدم API 36 المستقر. API 37 كان يتطلب ترخيص Android SDK Preview في بيئة CI، لذلك لم نعتمده في بناء إصدار 1.0.0.

## إعداد Supabase

عنوان المشروع الافتراضي مبني على project_id الموجود في supabase/config.toml. يلزم توفير المفتاح العام Publishable/anon من إعدادات Supabase:

- متغير بيئة: NEXUS_SUPABASE_PUBLISHABLE_KEY
- اختياري: NEXUS_SUPABASE_URL

أو في gradle.properties المحلي:
- nexusSupabasePublishableKey=...
- nexusSupabaseUrl=...

لا تضع service_role أو أي مفتاح سري في APK أو GitHub. المفتاح العام وحده لا يمنح صلاحيات؛ RLS هو الحاجز الأمني.

## الحالة

هذا هو أساس البناء الأول: إعداد Gradle، Compose، ثيم NEXUS، وربط Auth SDK. لا يحتوي بعد على كامل الشاشات أو تدفقات الحساب أو ربط بيانات الموقع. لا تعتبره إصدار 1.0.0 جاهزاً.
