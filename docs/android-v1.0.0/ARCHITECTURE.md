# NEXUS Android 1.0.0 — Architecture Decision Record

**الهدف:** تطبيق Android أصلي يطابق وظائف موقع NEXUS ولا يختزلها في واجهات شكلية.  
**المستودع:** khdrgdo/khac  
**فرع العمل:** feat/android-v1.0.0-foundation  
**الحزمة المقترحة مبدئياً:** com.nexus.app (قابلة للتثبيت بعد تثبيت هوية النشر).

## 1. قرارات المنصة

- Kotlin حديثة + Jetpack Compose + Material 3، مع نظام تصميم NEXUS خاص وليس Material الافتراضي الجاهز.
- تطبيق Single-Activity مع Navigation 3 stable 1.2.2؛ لا نستخدم إصدار Navigation 3 alpha في نسخة إنتاجية.
- AndroidX Lifecycle وViewModel وStateFlow وCoroutines وcollectAsStateWithLifecycle.
- فصل UI/Data/Domain؛ Domain Use Cases حيث توجد قواعد مشتركة أو معقدة.
- Repositories هي واجهة كل شاشة مع البيانات. ممنوع أن تستدعي Composable أو ViewModel Supabase مباشرة.
- Dependency Injection عبر Hilt بعد تثبيت توافق إصدارات Kotlin/AGP/KSP؛ لا نسمح بإنشاء clients داخل الشاشات.
- Supabase Kotlin SDK عبر واجهة داخل data-supabase، مع auth/postgrest/realtime/storage. نغلف SDK خلف interfaces حتى لا يرتبط منطق التطبيق بتفاصيل مكتبة واحدة.
- Ktor Engine يدعم WebSockets لأن Realtime جزء أساسي من المحادثات والتعليقات.
- Room للتخزين المحلي المنظم والـ cache والبيانات اللازمة لاستعادة الشاشة؛ DataStore للإعدادات غير الحساسة. لا نعد المستخدم بكتابة offline-first قبل اعتماد قواعد تعارض/مزامنة واضحة.
- Coil 3 لتحميل الصور، Paging 3 للقوائم الطويلة، WorkManager للمهام المؤجلة التي تحتاج ضمان إعادة المحاولة.
- لا Firebase Admin key ولا Supabase service_role داخل APK. المفتاح العام anon/publishable فقط، مع RLS وسياسات server-side.
- لا نخزن كلمات المرور. جلسة Supabase تُدار عبر SessionManager آمن يعتمد Android Keystore؛ يجب التحقق من طريقة تخزين SDK الفعلية قبل قبولها.
- Google OAuth عبر تدفق Android موثق وdeep links موثقة، مع PKCE/redirect آمن؛ لا تمرير access token في query string.

## 2. إصدارات مرجعية بتاريخ 23 نوفمبر 2026

هذه نقاط بدء مبنية على صفحات الإصدارات الرسمية وقت التدقيق، وليست ترخيصاً بتثبيت إصدار غير متوافق. يجب أن ينجح Gradle sync وCI على مصفوفة واحدة قبل تثبيتها نهائياً في libs.versions.toml.

| المكوّن | الإصدار المرجعي |
|---|---|
| Kotlin | 2.4.21 |
| Android Gradle Plugin | 9.5.2 |
| Gradle Wrapper | 9.6.0 |
| Compose BOM | 2026.06.00 |
| Navigation 3 | 1.2.1 stable |
| Lifecycle | 2.10.0 |
| Room | 2.8.5 |
| DataStore | 1.3.0 |
| Supabase Kotlin | 3.9.0 |
| Ktor | 3.4.3 وفق بطاقة مشروع SDK |
| compileSdk / targetSdk | أحدث API stable متوافق مع AGP وCompose وقت البناء؛ لا نستخدم preview SDK للإنتاج |
| minSdk | 26 على الأقل إذا اعتمدنا Supabase Kotlin كما توضح وثائق التثبيت |

تُستخدم الإصدارات المستقرة فقط في مسار الإصدار. أي إصدار تجريبي يحتاج ADR واختباراً منفصلاً وموافقة تقنية قبل دخوله release.

## 3. وحدات المشروع

- android/app
- android/core/common
- android/core/model
- android/core/designsystem
- android/core/network
- android/core/database
- android/core/datastore
- android/core/testing
- android/data/auth
- android/data/profiles
- android/data/feed
- android/data/messaging
- android/data/courses
- android/data/leaderboard
- android/data/notifications
- android/data/administration
- android/domain/auth
- android/domain/moderation
- android/domain/messaging
- android/domain/courses
- android/domain/ranking
- android/feature/auth
- android/feature/onboarding
- android/feature/feed
- android/feature/postdetail
- android/feature/profile
- android/feature/messages
- android/feature/courses
- android/feature/leaderboard
- android/feature/saved
- android/feature/notifications
- android/feature/admin
- android/build-logic
- android/gradle

حدود الاعتماد:
- feature يعتمد على domain/core، وليس على Supabase مباشرة.
- domain يعتمد على interfaces وcore/model ولا يعرف Compose أو Android UI.
- data ينفذ interfaces ويحوّل DTO إلى domain models.
- app يركب Dependency Injection والتنقل والـ root state فقط.
- core/designsystem لا يحتوي منطق أعمال أو استدعاءات شبكة.

## 4. طبقة البيانات وعقد Supabase

- تعريف DTOs مطابقة لأسماء الحقول الحقيقية، مع nullability دقيقة وenum serialization آمن.
- تحويل DTO إلى domain models في mapper مستقل.
- كل استدعاء شبكة يعيد Result/typed error، لا يبتلع الخطأ ولا يعرض رسالة خام من قاعدة البيانات للمستخدم.
- Pagination بمؤشر ثابت أو created_at + id؛ لا تحميل كل posts أو profiles دفعة واحدة.
- Realtime channels تُدار بعمر الشاشة/المستودع، وتُغلق عند تسجيل الخروج أو تغيير المستخدم.
- منع اشتراكات مكررة، وإعادة الاتصال مع backoff، ثم refresh موضعي للبيانات عند رجوع الشبكة.
- signed URLs قصيرة العمر وتُجدد عند انتهاء الصلاحية؛ لا تخزين رابط منتهي كأنه دائم.
- عمليات رفع الملفات ذات خطوتين: upload object ثم حفظ metadata؛ عند فشل الثانية تُزال الأولى أو يُسجل orphan cleanup.
- لا يُسمح للتطبيق باحتساب النقاط أو اتخاذ قرار الحظر/الرتبة أو إظهار هوية المجهول بنفسه؛ هذه قرارات خادم.
- كل mutation إما RPC موثوقة أو عملية PostgREST محمية بسياسة RLS. لا fallback صامت يغير دلالة العملية.

## 5. الجلسات وتدفق الدخول

1. عند التشغيل: استعادة جلسة آمنة من Supabase Auth.
2. تحميل profile + roles + subadmin_permissions من المصدر الموثوق.
3. إذا لا توجد جلسة: Auth flow.
4. إذا must_change_password: شاشة تغيير كلمة المرور، ولا يسمح بتجاوزها.
5. إذا البيانات الأكاديمية ناقصة: إكمال الملف.
6. بناء Navigation graph بحسب الدور، مع حماية ثانية على الخادم لكل طلب.
7. عند logout: إغلاق realtime channels، مسح cache الخاص بالمستخدم، إلغاء tokens المحلية، ومسح بيانات التنقل.
8. الرقم الجامعي يتحول إلى البريد الداخلي بنفس الدالة الموجودة في الموقع: number@college.edu. لا يظهر البريد الاصطناعي في UI.
9. مسار sub_admin القديم يُحافظ عليه مؤقتاً للتوافق حتى يقرر توحيد الهوية، ولا يسمح بتخمين الدور من صيغة الرقم.

## 6. التنقل وتجربة الاستخدام

- Navigation 3 مع مفاتيح typed لكل وجهة، حفظ back stack، deep links، واستعادة الحالة بعد process death.
- هاتف: bottom navigation للأقسام الرئيسية؛ شاشات التفاصيل تفتح فوقها ولا تفقد موضع الموجز.
- شاشة الرسائل: قائمة محادثات ثم تفاصيل المحادثة، مع Back واضح وإدارة لوحة المفاتيح.
- لوحة الإدارة: تبويب/قائمة مستقلة تظهر للأدوار المصرح بها؛ لا تخلط أدوات المشرف مع أدوات الطالب.
- أجهزة واسعة: Navigation rail أو permanent navigation وtwo-pane للمحادثات والمقررات والإدارة.
- RTL أصلي، وليس قلباً آلياً لكل العناصر؛ الأرقام والمعرفات والبريد والروابط تعرض LTR.
- دعم Edge-to-edge وIME insets وgesture navigation وpredictive back.
- كل عنصر تفاعلي يملك مساحة لمس لا تقل عن 48dp، ووصف TalkBack، وتبايناً مناسباً، وحالة focus واضحة.
- حالات كل شاشة: loading، empty، error، offline/stale، permission denied، retry، partial content.
- لا توجد أزرار زخرفية؛ كل عنصر ظاهر إما ينفذ فعلاً أو لا يظهر.

## 7. نظام تصميم NEXUS

- اعتماد النموذج التفاعلي الذي أقره المستخدم أساساً، ثم رفع دقته من دون تحويله إلى قالب AI.
- لوحة ألوان بنفسجية/ملكية متوازنة مع درجات محايدة واضحة، ووضع داكن حقيقي؛ اللون لا يستخدم لتعويض ضعف التسلسل البصري.
- خطوط عربية محلية داخل APK، أساسها IBM Plex Sans Arabic أو بديل اختباري واضح، مع ضبط المقاسات والارتفاعات.
- مكونات أصلية: PostCard، ReactionBar، CommentThread، ConversationRow، MessageBubble، CourseMaterialRow، ProfileHeader، RankProgress، AdminMetric، ModerationCase.
- لا نستخدم بطاقة لكل شيء؛ قوائم تحريرية كثيفة عند الحاجة ومساحات بيضاء مقصودة.
- Motion محدود بوظيفة: الانتقال، التأكيد، فتح التعليقات، وإظهار الحالة. احترام Reduce Motion.
- الصور والوسائط تُحمل تدريجياً مع placeholders وقيود الحجم.

## 8. النطاق الوظيفي للإصدار 1.0.0

1. Auth + إكمال الملف + استعادة كلمة المرور + Google OAuth.
2. جميع أدوار الموقع وصلاحياتها، بما فيها admin وsub_admin.
3. Feed + المنشورات + الصور + reactions + saved + reports.
4. Post detail + threaded comments + anonymous + accepted answer.
5. Messaging: DM/group + realtime + unread/read + block/report/leave/delete.
6. Profiles + privacy + avatar + activity + ranks.
7. Courses + mine + details + management + files/links/schedule/updates/discussions.
8. Leaderboard + filters + ranking.
9. Notifications + in-app state + deep links؛ push background مشروط بإكمال backend FCM.
10. Admin dashboard بجميع تبويباتها: stats, users, sub-admins, teachers, courses, reports, banned words, activity log, pinned card, broadcast notifications, name requests بعد إصلاح جدولها.
11. إعدادات الحساب والثيم واللغة/إمكانية الوصول، مع الحفاظ على السلوك الموجود بالموقع.

لا يُسمى الإصدار 1.0.0 كاملاً إذا كان مجرد طالب/موجز، أو إذا كانت لوحة الإدارة غائبة.

## 9. الأمن والخصوصية

- RLS مفعل على كل جدول يقرأه/يكتبه العميل.
- أقل صلاحية ممكنة لكل دور؛ UI gating ليس بديلاً عن RLS.
- إغلاق execute عن anon/public لكل SECURITY DEFINER لا يحتاجه anon، وإعادة منح authenticated بعد مراجعة كل function.
- كل SECURITY DEFINER يحدد search_path ثابتاً، ويتحقق من auth.uid() داخل الدالة، ولا يثق في user_id مرسل من العميل.
- لا تعتمد هوية الأدمن على بريد/رقم جامعي ثابت في function عامة.
- لا تسمح metadata القادمة من signUp بتعيين role.
- إخفاء هوية anonymous authors عن المستخدمين العاديين حتى في RPC وRealtime وlogs.
- تنظيف بيانات المستخدم من cache عند logout، ومنع تسرب حساب إلى حساب آخر على الجهاز.
- حماية الروابط الموقعة والملفات الشخصية والإبلاغ والمراسلة.
- عدم تسجيل access/refresh tokens أو كلمات المرور أو بيانات خاصة في logs.

## 10. الاختبارات وبوابة الإصدار

### اختبارات آلية
- Unit tests: mapping، validation، permissions، rank calculations، notification dedupe، date/time.
- Repository tests: نجاح/فشل/timeout/expired session/empty result.
- Contract tests: أسماء RPC وحقول الجداول وRLS.
- UI tests: Compose semantics، RTL، keyboard، scrolling، adaptive layouts.
- Integration tests: Supabase local أو بيئة اختبار منفصلة، لا بيانات الإنتاج.
- Screenshot tests للشاشات الأساسية والفروق في الوضعين الفاتح والداكن.
- Security tests: student لا يقرأ بيانات طالب آخر، teacher لا يدير مقرراً غير مخول، sub_admin لا يتجاوز صلاحياته، admin actions تُسجل، anonymous لا يكشف الهوية.
- Chat tests: منع DM للنفس، إعادة استخدام DM، منع الحظر، أعضاء المجموعة، read state، حذف/مغادرة، إعادة الاتصال.
- Upload tests: الملف الكبير/الامتداد غير المدعوم/انقطاع الشبكة/فشل حفظ metadata/signed URL منتهي.

### CI
- Gradle wrapper مثبت ومتحقق checksum.
- ktfmt أو spotless + detekt + Android lint.
- unitTest + connected tests عند توفر emulator.
- assembleDebug وassembleRelease.
- dependency verification وsecret scanning.
- لا يُنشر APK إلا من commit معروف مع سجل CI ناجح.
- لا نضع keystore أو service_role أو أسرار في Git. Release signing عبر GitHub Actions secrets فقط.

### تعريف Done
ميزة مكتملة = UI + domain logic + data mapping + backend contract + role authorization + failure states + automated test + device smoke test. لا تكفي لقطة شاشة أو compile ناجح.
