# NEXUS — Supabase Backend Contract

هذا العقد مستخرج من src/integrations/supabase/types.ts في الفرع main. هو عقد الشيفرة المولدة الموجودة بالمستودع، وليس ضماناً بأن قاعدة الإنتاج لم تتغير بعد آخر توليد للملف. قبل إطلاق التطبيق يجب مطابقة هذا الملف مع Supabase live schema وRPC catalog.

## 1. الجداول وحقول Row

| الجدول | الحقول |
|---|---|
| admin_actions | action, admin_id, created_at, details, id, target_user_id |
| anonymous_authors | author_id, content_id, content_type, created_at |
| banned_words | created_at, id, word |
| blocked_users | blocked_id, blocker_id, created_at |
| comments | author_id, content, created_at, id, is_anonymous, parent_id, post_id |
| conversation_members | conversation_id, joined_at, last_read_at, user_id |
| conversations | created_at, created_by, id, is_group, name, updated_at |
| course_links | course_id, created_at, created_by, id, is_important, link_type, title, url |
| course_updates | author_id, content, course_id, created_at, id, image_paths |
| courses | created_at, created_by, description, id, major, name, schedule, semester, teacher_id, updated_at, year |
| message_reports | conversation_id, created_at, id, note, reason, reported_user_id, reporter_id, status |
| messages | content, conversation_id, created_at, id, sender_id |
| notifications | actor_avatar, actor_id, actor_name, body, created_at, id, link, priority, read, recipient_id, title, type |
| pinned_cards | action_button_text, action_button_url, badge_text, created_at, description, enabled, end_date, id, image_url, participants, poll_options, target_major, target_year, theme, title, type, updated_at, votes |
| post_reactions | created_at, post_id, reaction, user_id |
| post_reports | created_at, id, post_id, reason, reporter_id, status |
| posts | accepted_answer_id, author_id, content, created_at, id, image_paths, images, is_anonymous, post_type, updated_at |
| profiles | avatar_url, banned, bio, card_theme_id, created_at, email, full_name, hide_university_number, id, major, must_change_password, points, suspended_until, theme, university_number, updated_at, verified, warning_count, year |
| saved_posts | created_at, post_id, user_id |
| subadmin_permissions | can_courses, can_reports, can_suspend, can_teachers, can_warn, can_words, created_at, user_id |
| user_roles | created_at, id, role, user_id |
| user_warnings | created_at, id, issued_by, reason, user_id |

**جدول غير موجود في generated types:** name_change_requests، رغم وجود مراجع إليه في بعض مكونات الإدارة. لا تنشئ Android DTO أو استعلاماً لهذا الجدول قبل إثباته أو إضافة migration.

## 2. Enums

- app_role: student | teacher | admin | sub_admin
- major_code: it | is | se
- post_type: general | question
- rank_tier: bronze | silver | gold | platinum | diamond
- reaction_type: like | love | haha | wow | sad
- report_status: pending | confirmed | dismissed

يجب التعامل مع enum غير المعروف مستقبلاً كقيمة غير معروفة قابلة للعرض الآمن، لا انهيار التطبيق.

## 3. RPC signatures من generated types

| RPC | Arguments | Return |
|---|---|---|
| admin_adjust_points | _delta, _user | number |
| admin_ban | _reason, _user | void |
| admin_delete_user | _user | void |
| admin_set_teacher_role | _user | void |
| admin_set_user_role | _role, _user | void |
| admin_set_verified | _user, _verified | void |
| admin_set_year | _user, _year | void |
| admin_suspend | _days, _reason, _user | void |
| admin_unban | _user | void |
| admin_warn | _reason, _user | number |
| award_points | _delta, _user | void |
| compute_rank | _points | rank_tier |
| create_comment_as | _anonymous?, _content, _parent_id?, _post_id | string |
| create_dm | _other | string |
| create_group | _members, _name | string |
| create_post_as | _anonymous?, _content, _images?, _post_type? | string |
| delete_conversation | _conv_id, _user_id | void |
| get_anonymous_authors | _ids, _type | author rows |
| get_conversation_unread_counts | _user_id | conversation_id + unread_count |
| get_courses_with_counts | none | course summary rows |
| get_daily_posts | since | count + day |
| get_daily_user_registrations | since | count + day |
| get_leaderboard_profiles | _major?, _year? | leaderboard profile rows |
| get_public_profiles | _ids | public profile rows |
| get_recent_admin_activity | none | activity rows |
| get_unread_message_count | _user_id | number |
| has_role | _role, _user_id | boolean |
| has_subadmin_permission | _permission, _user_id | boolean |
| is_anonymous_owner | _id, _type, _user | boolean |
| is_conversation_member | _conv, _user | boolean |
| is_main_admin | _user_id | boolean |
| leave_conversation | _conv_id, _user_id | void |
| mark_conversation_read | _conv_id, _user_id | void |
| search_public_profiles | _q | public search rows |
| toggle_pinned_card_participation | p_user_id | JSON |
| vote_on_poll | p_option_id, p_user_id | JSON |

## 4. عقود تتطلب مراجعة أمنية قبل الاستدعاء

أي RPC تستقبل user_id من العميل يجب أن تتحقق داخل الخادم أن القيمة تطابق auth.uid() أو أن المستدعي يملك صلاحية صريحة. هذا ينطبق خصوصاً على:
- delete_conversation
- leave_conversation
- mark_conversation_read
- get_conversation_unread_counts
- get_unread_message_count
- has_role
- has_subadmin_permission
- is_main_admin
- is_anonymous_owner
- toggle_pinned_card_participation
- vote_on_poll
- award_points وكل admin_* RPC

لا تعتبر اسم الدالة أو إخفاء الزر دليلاً على التفويض. راجع SECURITY DEFINER، search_path، EXECUTE grants، وRLS.

## 5. RPC غير موجودة في generated types

- get_my_activity_notifications: notificationsStore الحالي يستدعيها، لكنها غير موجودة في Functions المولدة. يجب التحقق من live catalog أو إنشاء migration موثقة واختبارها.
- أي RPC غير موجودة هنا لكنها مستخدمة في source يجب تسجيلها في سجل الفجوات، وعدم إنشاء استدعاء Android لها قبل التحقق.

## 6. قواعد نمذجة Android

- UUIDs تُعامل كسلاسل String، ولا تُحوّل إلى أرقام.
- timestamps تُقرأ كـ Instant/OffsetDateTime ثم تعرض بالتوقيت المحلي.
- الحقول nullable تظل nullable في DTO؛ لا تستبدل null بسلسلة فارغة داخل طبقة الشبكة.
- Json في schedule/participants/poll_options/votes/details يُفك إلى نماذج typed مع fallback آمن.
- لا تحمل profiles.email أو university_number أو anonymous_authors إلى شاشة عامة لمجرد وجودها في Row type؛ استخدم RPC محدود الحقول واحترم hide_university_number.
- النقاط والرتبة والتوثيق والحظر والإيقاف وعداد التحذير مصدرها الخادم فقط.
- كل Insert/Update يجب أن يحدد أقل مجموعة حقول ممكنة، لا يرسل DTO كاملاً إلى قاعدة البيانات.
