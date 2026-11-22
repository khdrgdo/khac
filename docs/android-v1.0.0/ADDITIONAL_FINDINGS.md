# NEXUS — نتائج إضافية بعد مراجعة التنقل وتدفق الحساب

## AUTH-02 — مسار إكمال الملف
AuthContext ينشئ profile placeholder برقم U عشوائي عند غياب صف profile. AppLayout يفرض complete-profile عندما يكون major/year ناقصاً أو university_number يبدأ U. Android يجب أن يتعرف على placeholder ولا يعتبره رقماً جامعياً صالحاً. لا يولد أرقاماً جامعية من عنده.

## AUTH-03 — ترتيب حالة الحساب
Profile يحمل banned وsuspended_until وmust_change_password. التطبيق يجب أن يمنع الوصول للموجز قبل تحميل هذه الحقول وتطبيق القرار. لا يكفي نجاح Supabase Auth وحده لإعلان أن المستخدم أصبح داخل التطبيق.

## AUTH-04 — إكمال الملف لا يعمل فقط بعد Google
الموقع يمرر مستخدم Google إلى AppLayout، حيث يكتشف الملف الناقص. شاشة complete-profile تطلب الاسم والرقم الجامعي والتخصص والسنة، وتتحقق من uniqueness. يجب فرض ذلك على كل حساب ناقص أياً كانت طريقة دخوله.

## AUTH-05 — التسجيل وتأكيد البريد
التسجيل يستخدم البريد الحقيقي، والرقم الجامعي يخزن كبيان profile، ولا ينشئ بريد الرقم الجامعي للحساب الجديد. عند تفعيل Confirm Email قد لا تُنشأ session فوراً؛ يجب أن يعرض Android حالة انتظار التأكيد وإعادة المحاولة، لا شاشة نجاح دخول.

## AUTH-06 — إعادة تعيين كلمة المرور
الموقع يرسل رابط reset إلى /reset-password ثم يتحقق من وجود recovery session قبل السماح بتغيير كلمة المرور. Android يحتاج deep link موثوقاً وإعداد redirect allowlist في Supabase؛ من دون ذلك لن تعمل الاستعادة حتى لو كانت الشاشة موجودة.

## ADMIN-04 — صلاحيات المشرف المساعد غير متسقة
الكود يعرّف can_courses لكنه يخفي تبويب المقررات عن كل sub_admin، ويعرض pinned_card وbroadcast_notif وname_requests بلا فحص صلاحية مخصصة. يجب تحديد مصفوفة صلاحيات واضحة وإصلاح الويب/backend قبل نسخها.

## ADMIN-05 — روابط QuickActions لا تطابق التبويبات
QuickActions يستخدم teachers وbanned بينما القيم الفعلية teacher وwords، وAdminPage لا يقرأ search params لتفعيل التبويب. AdminSearch كذلك يرسل tab=users دون أن يستهلكه AdminPage. هذه روابط شكلية/ناقصة لا تنقل كما هي.

## ADMIN-06 — زر غير وظيفي
زر "ترقية للنظام الاحترافي" في AdminPage لا يفعل سوى toast قريباً. لا يُنقل إلى التطبيق كزر يوهم بوجود خدمة.

## ADMIN-07 — التصدير الإداري
QuickActions يصدّر بيانات profiles بما فيها الاسم والبريد والرقم الجامعي والتخصص والسنة إلى CSV. هذه وظيفة إدارية حساسة يجب أن تكون خلف تأكيد، وصلاحية محددة، وتسجيل تدقيق، وعدم وضعها في واجهة المشرف المساعد بلا قرار.

## SEARCH-01 — نطاق البحث العام
GlobalSearchDialog يبحث في posts وcomments وpeople ويبدأ DM من نتيجة شخص. AdminSearch مختلف ويبحث في profiles وcourses. يجب تنفيذ البحثين منفصلين واحترام إخفاء الرقم الجامعي والهوية المجهولة.

## SEARCH-02 — البحث الإداري واسع ومكلف
UsersTable يحمّل حتى 500 profile ثم يقرأ user_roles والنشاط من posts/comments/messages. لا تنقل هذا الاستعلام إلى Android؛ استخدم pagination وRPC إدارية ذات صلاحيات وحدود، وإلا ستظهر مشاكل أداء وتسريب بيانات.

## NOTIF-02 — الإشعارات تعمل بأكثر من مصدر
NotificationsPopover يدمج إشعارات جدول notifications مع تغييرات comments وpost_reactions وmessages وuser_warnings، ويعمل polling كل 15 ثانية إضافة إلى Realtime. يجب منع التكرار، وإغلاق القنوات عند logout، وعدم تشغيل polling غير محدود في الخلفية.
