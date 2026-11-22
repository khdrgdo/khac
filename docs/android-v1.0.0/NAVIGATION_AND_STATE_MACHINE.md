# NEXUS — Navigation and Account State Machine

## 1. Shell navigation verified in AppLayout.tsx

### Primary destinations
- /feed — الرئيسية
- /courses — الكورسات
- /courses/mine — مقرراتي؛ يظهر للـ teacher وadmin.
- /leaderboard — لوحة الصدارة
- /messages — المراسلة، مع unread badge
- /saved — المحفوظات
- /admin — الإدارة؛ يظهر فقط عند isAdmin، ويشمل admin وsub_admin.

على الهاتف، العناصر الستة الأساسية تظهر في bottom navigation. /admin لا يظهر في bottom navigation؛ يظهر كرابط إدارة في القائمة الجانبية على الشاشات الواسعة، وفي قائمة الحساب. ملف المستخدم يفتح من صورة الحساب، وليس من عنصر أساسي مستقل.

### عناصر الشريط العلوي
- GlobalSearchDialog: بحث شامل في المنشورات والتعليقات والأشخاص، بتبويبات all/posts/comments/people.
- NotificationsPopover: كل الإشعارات أو غير المقروء، عداد غير المقروء، تعليم الكل كمقروء، مسح الكل، حذف إشعار، فتح الرابط المرتبط.
- ThemeToggle: الوضع الفاتح/الداكن.
- صورة الحساب وقائمة المستخدم: ملفي الشخصي (مخفي عن sub_admin)، تغيير كلمة السر، لوحة الإدارة عند الصلاحية، تسجيل الخروج.
- زر تثبيت PWA والـ banner جزء من الويب فقط؛ لا ينقل إلى Android كما هو.

### قواعد العرض حسب الدور
- الطالب: feed/courses/leaderboard/messages/saved/profile.
- الأستاذ: ما سبق + courses/mine.
- admin: ما سبق + admin.
- sub_admin: ما سبق مع إخفاء ملفه الشخصي العام، ولوحة إدارة مقيدة بالصلاحيات.
- التحقق النهائي من الدور يجب أن يتم من الخادم؛ إخفاء عناصر التنقل ليس حماية.

## 2. البحث العام

GlobalSearchDialog يغطي:
- المنشورات: بحث ilike في content، أحدث 15 نتيجة، ثم جلب صاحب المنشور وعدد reactions/comments.
- التعليقات: بحث ilike في content، أحدث 15 نتيجة، ثم صاحب التعليق ومقتطف المنشور الأب.
- الأشخاص: search_public_profiles ثم get_public_profiles لاستكمال التخصص والسنة والنقاط والتوثيق.
- تبويبات all/posts/comments/people.
- فتح المنشور أو التعليق المرتبط، فتح الملف الشخصي، وبدء DM من نتيجة الشخص عبر getOrCreateDM.
- اختصار Ctrl+K/Cmd+K خاص بالويب؛ Android يحتاج حقل/زر بحث ظاهر ودعم لوحة مفاتيح اختيارياً.

AdminSearch مختلف: يبحث في المستخدمين والمقررات فقط. لا تدمج البحث الإداري مع البحث العام ولا تفقد اختلاف الصلاحيات.

## 3. حالة الحساب بعد المصادقة

الترتيب المطلوب في Android:
1. تحميل جلسة Auth.
2. التحقق من وجود user.
3. تحميل profile وroles وsubadmin_permissions من الخادم.
4. إذا فشل تحميل profile/roles: حالة خطأ قابلة لإعادة المحاولة؛ لا تُفترض student ولا admin.
5. إذا banned=true: منع الوصول وعرض حالة الحظر/تعليمات الدعم.
6. إذا suspended_until في المستقبل: منع الوظائف المحظورة حتى انتهاء الوقت مع عرض السبب/المدة إذا سمح العقد.
7. إذا must_change_password=true: فرض شاشة تغيير كلمة المرور قبل بقية التطبيق.
8. إذا كان profile ناقصاً: فرض إكمال الملف قبل الموجز.
9. بناء Navigation graph وفق الدور والصلاحيات.
10. عند logout: إغلاق realtime، إلغاء عمليات المستخدم، مسح cache والتنقل الخاص به، ثم إنهاء الجلسة.

### اكتمال الملف
الموقع ينشئ أحياناً profile placeholder برقم يبدأ U، ثم يعتبر الحساب ناقصاً إذا:
- major فارغ، أو
- year فارغ، أو
- university_number يبدأ U.

شاشة complete-profile تطلب:
- الاسم الكامل.
- الرقم الجامعي، 5 أحرف/أرقام على الأقل بحسب تحقق الموقع.
- التخصص: it أو is أو se.
- السنة الدراسية من YEARS.
- منع الرقم الجامعي المكرر.
بعد الحفظ يجب إعادة تحميل profile ثم فتح الموجز. لا تنشئ Android رقماً جامعياً عشوائياً لإخفاء نقص البيانات.

### التسجيل
التسجيل لا يستخدم الرقم الجامعي كبريد دخول. يطلب:
- الرقم الجامعي (5 أحرف/أرقام أو أكثر).
- البريد الإلكتروني الفعلي.
- الاسم الكامل.
- التخصص.
- السنة.
- كلمة مرور 6 أحرف على الأقل.
ويرسل metadata: university_number، full_name، major، year، role=student، must_change_password=false.
إذا كان تأكيد البريد مفعلاً، لا توجد جلسة مباشرة؛ تعرض شاشة انتظار التفعيل والبريد المستخدم. Device Guard موجود في UI لكن helper الحالي معطل، لذلك لا تفرض قيد جهاز في Android.

### استعادة كلمة المرور
- طلب رابط على البريد الفعلي.
- deep link يعيد المستخدم إلى التطبيق.
- التحقق من recovery session.
- إدخال كلمة مرور جديدة وتأكيدها.
- استدعاء updateUser ثم العودة لتسجيل الدخول/الموجز وفق الجلسة.
- يجب أن يسمح Supabase Auth URL allowlist بمخطط التطبيق؛ هذه إعدادات backend غير موجودة في GitHub ويجب التحقق منها.

### Google OAuth
الموقع يستعمل Lovable OAuth ثم fallback إلى Supabase Google OAuth. Android يستعمل Supabase OAuth native redirect، ولا يعيد استخدام mobileAuthBridge الذي يمرر session من الويب. يجب إضافة deep link allowlist واختبار إلغاء OAuth والعودة من المتصفح.

## 4. لوحة الإدارة: التبويبات الفعلية

- مؤشرات وإحصاءات ورسوم بيانية ونشاط أخير.
- AdminSearch.
- QuickActions.
- Reports.
- Users.
- Activity log (main admin فقط).
- Teachers.
- Banned words.
- Sub-admin accounts (main admin فقط).
- Courses management (main admin فقط في الكود الحالي).
- Pinned card and events.
- Broadcast notifications.
- Name change requests (غير مثبتة backend).

صلاحيات المشرف المساعد في جدول subadmin_permissions:
can_warn، can_suspend، can_courses، can_reports، can_words، can_teachers.

## 5. تناقضات في الموقع يجب ألا تُنقل كما هي

- QuickActions يوجه بعض الأزرار إلى قيم tabs غير مطابقة للقيم الفعلية: teachers بدلاً من teacher، وbanned بدلاً من words. كما أن AdminPage لا يقرأ search param لتحديد التبويب؛ قد يبدو الضغط ناجحاً لكنه لا يغير التبويب.
- AdminSearch يرسل tab=users في URL، لكن AdminPage لا يقرأ ذلك لتحديد تبويب Users.
- can_courses موجودة في الصلاحيات لكن تبويب courses مخفي عن كل sub_admin بغض النظر عن قيمة can_courses.
- pinned_card وbroadcast_notif وname_requests تظهر للمشرف المساعد دون فحص صلاحية مخصصة مقابلة.
- AdminPage يحتوي زر ترقية للنظام الاحترافي ينفذ toast "قريباً" فقط؛ لا ينقل إلى Android.
- AdminQuickActions "إضافة مستخدم" يوجه إلى تبويب المستخدمين ولا ينشئ مستخدماً بذاته؛ "إضافة مقرر" يوجه إلى تبويب المقررات.
- UsersTable يحمل حتى 500 profile ويقرأ user_roles، posts، comments، messages لحساب النشاط؛ Android لا يكرر هذا النمط غير المحدود. يجب أن تكون هناك pagination واستعلامات إدارية server-side.
- AdminSearch يقرأ email للمستخدمين؛ لا تعرضه في نتائج Android إلا لمن يملك صلاحية واضحة.
- AuthContext يبدأ صلاحيات sub_admin كلها true قبل تحميلها. Android يبدأ loading/false ولا يعرض أدوات الإدارة قبل اكتمال تحميل الصلاحيات.
- بعض مسارات إدارة المستخدمين تنفذ insert/delete مباشرة على user_roles؛ الأفضل نقل تعديل الدور إلى RPC محمية مع تسجيل admin_actions.
