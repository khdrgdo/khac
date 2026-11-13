package com.nexus.app.data

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.concurrent.TimeUnit
import java.util.UUID
import android.webkit.MimeTypeMap

class ApiException(message: String, val statusCode: Int = 0) : Exception(message)

class NexusRepository(context: Context) {
    private val appContext = context.applicationContext
    private val store = SecureSessionStore(appContext)
    private val client = OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).writeTimeout(30, TimeUnit.SECONDS).retryOnConnectionFailure(true).build()
    private val refreshMutex = Mutex()
    private val baseUrl = com.nexus.app.BuildConfig.SUPABASE_URL.trimEnd('/')
    private val publishableKey = com.nexus.app.BuildConfig.SUPABASE_PUBLISHABLE_KEY
    private var session: UserSession? = store.read()?.let(::decodeSession)
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    suspend fun signIn(identifier: String, password: String): StudentProfile {
        val body = JSONObject().put("email", normalizeLoginIdentifier(identifier)).put("password", password)
        val raw = execute(Request.Builder().url(baseUrl + "/auth/v1/token?grant_type=password").header("apikey", publishableKey).post(body.toString().toRequestBody(jsonType)).build())
        session = sessionFrom(JSONObject(raw))
        persistSession()
        return try {
            val profile = loadCurrentProfile()
            verifyStudentAccess(profile)
            profile
        } catch (error: Exception) {
            session = null
            store.clear()
            throw error
        }
    }

    suspend fun restoreSession(): StudentProfile? {
        if (session == null) session = store.read()?.let(::decodeSession)
        if (session == null) return null
        ensureFreshSession()
        val user = JSONObject(rest("/auth/v1/user"))
        val userId = user.optString("id")
        if (userId.isBlank()) throw ApiException("تعذّر التحقق من جلسة الدخول")
        session = session?.copy(userId = userId)
        persistSession()
        val profile = loadProfile(userId)
        verifyStudentAccess(profile)
        return profile
    }

    fun acceptDeepLink(uri: Uri?): Boolean {
        if (uri == null || uri.scheme != "com.nexus.app" || uri.host != "login-callback") return false
        val fragment = uri.fragment ?: return false
        val params = Uri.parse("https://nexus.invalid/?" + fragment)
        val access = params.getQueryParameter("access_token") ?: return false
        val refresh = params.getQueryParameter("refresh_token") ?: return false
        val expiresIn = params.getQueryParameter("expires_in")?.toLongOrNull() ?: 3600L
        session = UserSession(access, refresh, System.currentTimeMillis() / 1000L + expiresIn, "")
        persistSession()
        return true
    }

    suspend fun loadHome(profile: StudentProfile): Pair<List<Course>, List<CourseMaterial>> {
        val majorFilter = profile.major?.let { "&major=eq." + encode(it) } ?: ""
        val courseRows = array(rest("/rest/v1/courses?select=id,name,description,major,year,semester,teacher_id,schedule,created_at,updated_at" + majorFilter + "&order=year.asc,semester.asc,name.asc"))
        val teacherProfiles = publicProfiles(courseRows.mapNotNull { it.optStringOrNull("teacher_id") }.toSet())
        val ids = courseRows.mapNotNull { it.optStringOrNull("id") }
        if (ids.isEmpty()) return emptyList<Course>() to emptyList()
        val inFilter = ids.joinToString(",")
        val linkRows = array(rest("/rest/v1/course_links?select=id,course_id,link_type,created_at&course_id=in.(" + inFilter + ")&order=created_at.desc"))
        val stats = linkRows.groupBy { it.optString("course_id") }
        val courses = courseRows.map { row ->
            val links = stats[row.optString("id")].orEmpty()
            Course(
                id = row.optString("id"), name = row.optString("name"), description = row.optStringOrNull("description"),
                major = row.optString("major"), year = row.optInt("year"), semester = row.optInt("semester"),
                teacherId = row.optStringOrNull("teacher_id"), teacherName = teacherProfiles[row.optStringOrNull("teacher_id")]?.fullName,
                schedule = parseSchedule(row.optJSONArray("schedule")),
                fileCount = links.count { it.optStringOrNull("link_type") == "file" },
                linkCount = links.count { it.isNull("link_type") },
                lastUpdated = links.firstOrNull()?.optStringOrNull("created_at") ?: row.optStringOrNull("updated_at")
            )
        }
        val recentRows = array(rest("/rest/v1/course_links?select=id,course_id,title,url,link_type,created_at,is_important&course_id=in.(" + inFilter + ")&order=created_at.desc&limit=8"))
        val names = courses.associate { it.id to it.name }
        return courses to recentRows.map { materialFrom(it, names[it.optString("course_id")]) }
    }

    suspend fun loadFeed(savedOnly: Boolean = false): List<FeedPost> {
        val currentUser = session?.userId.orEmpty()
        val savedAll = if (currentUser.isBlank()) emptyList() else array(rest("/rest/v1/saved_posts?select=post_id&user_id=eq.${encode(currentUser)}&order=created_at.desc&limit=200"))
            .map { it.optString("post_id") }.filter(String::isNotBlank)
        if (savedOnly && savedAll.isEmpty()) return emptyList()
        val postQuery = if (savedOnly) "id=in.(${savedAll.joinToString(",") { encode(it) }})&order=created_at.desc" else "order=created_at.desc&limit=50"
        val rows = array(rest("/rest/v1/posts?select=id,author_id,content,images,created_at,is_anonymous,post_type,accepted_answer_id&$postQuery"))
        val ids = rows.mapNotNull { it.optStringOrNull("author_id") }.toSet()
        val profiles = publicProfiles(ids)
        val postIds = rows.mapNotNull { it.optStringOrNull("id") }
        if (postIds.isEmpty()) return emptyList()
        val inFilter = postIds.joinToString(",")
        val commentCounts = array(rest("/rest/v1/comments?select=post_id&post_id=in.($inFilter)"))
            .groupingBy { it.optString("post_id") }.eachCount()
        val reactionsByPost = array(rest("/rest/v1/post_reactions?select=post_id,user_id,reaction&post_id=in.($inFilter)"))
            .groupBy { it.optString("post_id") }
        val savedIds = savedAll.toSet()
        return rows.map { row ->
            val authorId = row.optStringOrNull("author_id")
            val anonymous = row.optBoolean("is_anonymous") || authorId == null
            val author = profiles[authorId]
            val postId = row.optString("id")
            val reactions = reactionsByPost[postId].orEmpty().map { FeedReaction(it.optString("user_id"), it.optString("reaction")) }
            val imagePaths = row.optJSONArray("images")?.let { a -> (0 until a.length()).mapNotNull { a.optString(it).takeIf(String::isNotBlank) } }.orEmpty()
            val signedImages = imagePaths.mapNotNull { path -> runCatching { signedStorageUrl("post-images", path) }.getOrNull() }
            FeedPost(postId, authorId,
                if (anonymous) "طالب مجهول" else author?.fullName ?: "طالب",
                if (anonymous) null else author?.avatarUrl, anonymous,
                row.optString("content"), row.optString("post_type", "general"),
                row.optString("created_at"), commentCounts[postId] ?: 0, signedImages, reactions,
                reactions.firstOrNull { it.userId == currentUser }?.type, postId in savedIds,
                row.optStringOrNull("accepted_answer_id"))
        }
    }

    suspend fun createFeedPost(content: String, anonymous: Boolean, postType: String = "general", images: List<String> = emptyList()) {
        rest("/rest/v1/rpc/create_post_as", "POST", JSONObject()
            .put("_content", content.trim()).put("_images", JSONArray(images)).put("_post_type", postType).put("_anonymous", anonymous))
    }



    suspend fun uploadPostImage(uri: Uri): String {
        val current = session ?: throw ApiException("جلسة غير صالحة")
        val mime = appContext.contentResolver.getType(uri) ?: "image/jpeg"
        if (!mime.startsWith("image/")) throw ApiException("يسمح برفع الصور فقط")
        val bytes = appContext.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: throw ApiException("تعذرت قراءة الصورة")
        if (bytes.size > 5 * 1024 * 1024) throw ApiException("حجم الصورة أكبر من 5MB")
        val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime) ?: "jpg"
        val path = current.userId + "/" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().take(6) + "." + ext
        val request = Request.Builder().url(baseUrl + "/storage/v1/object/post-images/" + Uri.encode(path, "/"))
            .header("apikey", publishableKey).header("Authorization", "Bearer " + current.accessToken)
            .header("Content-Type", mime).header("x-upsert", "false")
            .post(bytes.toRequestBody(mime.toMediaType())).build()
        execute(request)
        return path
    }

    suspend fun togglePostReaction(postId: String, reaction: String?) {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        if (reaction == null) {
            rest("/rest/v1/post_reactions?post_id=eq.${encode(postId)}&user_id=eq.${encode(userId)}", "DELETE")
        } else {
            rest("/rest/v1/post_reactions?on_conflict=post_id,user_id", "POST",
                JSONObject().put("post_id", postId).put("user_id", userId).put("reaction", reaction),
                mapOf("Prefer" to "resolution=merge-duplicates,return=minimal"))
        }
    }

    suspend fun toggleSavedPost(postId: String, saved: Boolean) {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        if (saved) rest("/rest/v1/saved_posts?post_id=eq.${encode(postId)}&user_id=eq.${encode(userId)}", "DELETE")
        else rest("/rest/v1/saved_posts", "POST", JSONObject().put("post_id", postId).put("user_id", userId))
    }

    suspend fun reportPost(postId: String, reason: String) {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        rest("/rest/v1/post_reports", "POST", JSONObject().put("post_id", postId).put("reporter_id", userId).put("reason", reason))
    }

    suspend fun deletePost(postId: String) {
        rest("/rest/v1/posts?id=eq.${encode(postId)}", "DELETE")
    }

    private suspend fun signedStorageUrl(bucket: String, path: String): String {
        val encodedPath = Uri.encode(path, "/")
        val json = JSONObject(rest("/storage/v1/object/sign/$bucket/$encodedPath", "POST", JSONObject().put("expiresIn", 3600)))
        val signed = json.optString("signedURL").ifBlank { json.optString("signedUrl") }
        if (signed.isBlank()) throw ApiException("تعذّر تحميل الصورة")
        return if (signed.startsWith("http")) signed else baseUrl + "/storage/v1" + if (signed.startsWith("/")) signed else "/" + signed
    }




    suspend fun searchPublicUsers(query: String): List<PublicUser> {
        if (query.trim().length < 2) return emptyList()
        val rows = array(rest("/rest/v1/rpc/search_public_profiles", "POST", JSONObject().put("_q", query.trim())))
        return rows.map { PublicUser(it.optString("id"), it.optString("full_name", "مستخدم"), it.optString("university_number"), it.optStringOrNull("avatar_url"), it.optStringOrNull("major")) }
    }

    suspend fun loadConversations(): List<ConversationPreview> {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        val memberships = array(rest("/rest/v1/conversation_members?select=conversation_id&user_id=eq.${encode(userId)}"))
        val ids = memberships.map { it.optString("conversation_id") }.filter(String::isNotBlank)
        if (ids.isEmpty()) return emptyList()
        val convs = array(rest("/rest/v1/conversations?select=id,is_group,name,created_by,updated_at&id=in.(${ids.joinToString(",")})&order=updated_at.desc"))
        return convs.map { c ->
            val id = c.optString("id")
            val members = array(rest("/rest/v1/conversation_members?select=user_id&conversation_id=eq.${encode(id)}"))
            val otherId = members.map { it.optString("user_id") }.firstOrNull { it != userId }
            val profile = if (otherId == null) null else array(rest("/rest/v1/rpc/get_public_profiles", "POST", JSONObject().put("_ids", JSONArray().put(otherId)))).firstOrNull()
            val last = array(rest("/rest/v1/messages?select=content,created_at&conversation_id=eq.${encode(id)}&order=created_at.desc&limit=1")).firstOrNull()
            ConversationPreview(id, if (c.optBoolean("is_group")) c.optString("name", "مجموعة") else profile?.optString("full_name", "محادثة") ?: "محادثة",
                c.optBoolean("is_group"), otherId, last?.optString("content").orEmpty(), c.optString("updated_at"))
        }
    }

    suspend fun loadMessages(conversationId: String): List<ChatMessage> = array(rest("/rest/v1/messages?select=id,conversation_id,sender_id,content,created_at&conversation_id=eq.${encode(conversationId)}&order=created_at.asc&limit=300"))
        .map { ChatMessage(it.optString("id"), it.optString("conversation_id"), it.optString("sender_id"), it.optString("content"), it.optString("created_at")) }

    suspend fun createDirectConversation(otherUserId: String): String {
        val raw = rest("/rest/v1/rpc/create_dm", "POST", JSONObject().put("_other", otherUserId)).trim()
        return runCatching { JSONObject(raw).optString("id") }.getOrDefault(raw.trim('"')).ifBlank { throw ApiException("تعذّر إنشاء المحادثة") }
    }

    suspend fun createGroupConversation(name: String, memberIds: List<String>): String {
        val raw = rest("/rest/v1/rpc/create_group", "POST", JSONObject().put("_name", name.trim()).put("_members", JSONArray(memberIds))).trim()
        return runCatching { JSONObject(raw).optString("id") }.getOrDefault(raw.trim('"')).ifBlank { throw ApiException("تعذّر إنشاء المجموعة") }
    }

    suspend fun sendMessage(conversationId: String, content: String) {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        if (content.isBlank()) return
        val members = array(rest("/rest/v1/conversation_members?select=user_id&conversation_id=eq.${encode(conversationId)}"))
        val otherIds = members.map { it.optString("user_id") }.filter { it != userId }
        for (otherId in otherIds) {
            val blocked = array(rest("/rest/v1/blocked_users?select=id&blocker_id=eq.${encode(userId)}&blocked_id=eq.${encode(otherId)}&limit=1"))
            if (blocked.isNotEmpty()) throw ApiException("أزل الحظر أولاً قبل إرسال رسالة")
        }
        rest("/rest/v1/messages", "POST", JSONObject().put("conversation_id", conversationId).put("sender_id", userId).put("content", content.trim()))
        rest("/rest/v1/conversations?id=eq.${encode(conversationId)}", "PATCH", JSONObject().put("updated_at", java.time.Instant.now().toString()))
    }

    suspend fun blockUser(userIdToBlock: String) {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        rest("/rest/v1/blocked_users", "POST", JSONObject().put("blocker_id", userId).put("blocked_id", userIdToBlock))
    }

    suspend fun reportMessageUser(conversationId: String, reportedUserId: String, reason: String, note: String?) {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        rest("/rest/v1/message_reports", "POST", JSONObject().put("reporter_id", userId).put("reported_user_id", reportedUserId)
            .put("conversation_id", conversationId).put("reason", reason).put("note", note?.takeIf(String::isNotBlank)?.let { it } ?: JSONObject.NULL))
    }



    suspend fun loadPinnedCard(): PinnedCardConfig? {
        val row = array(rest("/rest/v1/pinned_cards?select=id,enabled,type,theme,badge_text,title,description,image_url,end_date,action_button_text,action_button_url,target_year,target_major,poll_options,votes,participants&id=eq.pinned_featured_event_1&limit=1")).firstOrNull() ?: return null
        val options = row.optJSONArray("poll_options")?.let { a -> (0 until a.length()).mapNotNull { i -> a.optJSONObject(i)?.let { PollOption(it.optString("id"), it.optString("text")) } } }.orEmpty()
        val votesObject = row.optJSONObject("votes") ?: JSONObject()
        val votes = buildMap { val keys = votesObject.keys(); while (keys.hasNext()) { val key = keys.next(); put(key, votesObject.optString(key)) } }
        val participantsArray = row.optJSONArray("participants")
        val participants = participantsArray?.let { a -> (0 until a.length()).map { a.optString(it) }.filter(String::isNotBlank) }.orEmpty()
        return PinnedCardConfig(row.optString("id"), row.optBoolean("enabled"), row.optString("type", "event"), row.optString("theme", "royal"),
            row.optString("badge_text"), row.optString("title"), row.optString("description"), row.optStringOrNull("image_url"),
            row.optStringOrNull("end_date"), row.optStringOrNull("action_button_text"), row.optStringOrNull("action_button_url"),
            if (row.isNull("target_year")) null else row.optInt("target_year"), row.optStringOrNull("target_major"), options, votes, participants)
    }

    suspend fun voteOnPinnedPoll(optionId: String): Map<String, String> {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        val raw = rest("/rest/v1/rpc/vote_on_poll", "POST", JSONObject().put("p_user_id", userId).put("p_option_id", optionId))
        val obj = JSONObject(raw); return buildMap { val keys = obj.keys(); while (keys.hasNext()) { val key = keys.next(); put(key, obj.optString(key)) } }
    }

    suspend fun togglePinnedParticipation(): List<String> {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        val raw = rest("/rest/v1/rpc/toggle_pinned_card_participation", "POST", JSONObject().put("p_user_id", userId))
        val arr = runCatching { JSONArray(raw) }.getOrNull() ?: JSONArray()
        return (0 until arr.length()).map { arr.optString(it) }.filter(String::isNotBlank)
    }

    suspend fun loadAdminUsers(): List<AdminUser> {
        val rows = array(rest("/rest/v1/profiles?select=id,full_name,university_number,major,year,points,banned,suspended_until&order=points.desc&limit=500"))
        if (rows.isEmpty()) return emptyList()
        val ids = rows.map { it.optString("id") }
        val roleRows = array(rest("/rest/v1/user_roles?select=user_id,role&user_id=in.(${ids.joinToString(",") { encode(it) }})"))
            .groupBy { it.optString("user_id") }
        return rows.map { row -> val id = row.optString("id"); AdminUser(id, row.optString("full_name"), row.optString("university_number"),
            row.optStringOrNull("major"), if (row.isNull("year")) null else row.optInt("year"), row.optInt("points"), row.optBoolean("banned"),
            row.optStringOrNull("suspended_until"), roleRows[id].orEmpty().map { it.optString("role") }) }
    }

    suspend fun loadAdminReports(): List<AdminReport> {
        val reports = array(rest("/rest/v1/post_reports?select=id,post_id,reporter_id,reason,status,created_at&order=created_at.desc&limit=100"))
        if (reports.isEmpty()) return emptyList()
        val postIds = reports.map { it.optString("post_id") }.filter(String::isNotBlank).distinct()
        val reporterIds = reports.map { it.optString("reporter_id") }.filter(String::isNotBlank).distinct()
        val posts = if (postIds.isEmpty()) emptyMap() else array(rest("/rest/v1/posts?select=id,content&id=in.(${postIds.joinToString(",") { encode(it) }})")).associateBy { it.optString("id") }
        val profiles = publicProfiles(reporterIds)
        return reports.map { row -> val postId = row.optString("post_id"); val reporterId = row.optString("reporter_id")
            AdminReport(row.optString("id"), postId, posts[postId]?.optString("content").orEmpty(), profiles[reporterId]?.fullName ?: "مستخدم",
                row.optString("reason"), row.optString("status", "pending"), row.optString("created_at")) }
    }

    suspend fun updateProfileTheme(theme: String) {
        require(theme in setOf("stars", "clouds", "moon", "sun", "galaxy")) { "مظهر غير معروف" }
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        rest("/rest/v1/profiles?id=eq.${encode(userId)}", "PATCH", JSONObject().put("theme", theme))
    }

    suspend fun updateProfileBio(bio: String?) {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        rest("/rest/v1/profiles?id=eq.${encode(userId)}", "PATCH", JSONObject().put("bio", bio?.trim()?.takeIf(String::isNotBlank) ?: JSONObject.NULL))
    }

    suspend fun loadNotifications(): List<NotificationItem> {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        return array(rest("/rest/v1/notifications?select=id,title,body,type,link,read,created_at&recipient_id=eq.${encode(userId)}&order=created_at.desc&limit=100"))
            .map { row -> NotificationItem(row.optString("id"), row.optString("title"), row.optString("body"), row.optString("type"), row.optStringOrNull("link"), row.optBoolean("read"), row.optString("created_at")) }
    }

    suspend fun markNotificationRead(id: String) {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        rest("/rest/v1/notifications?id=eq.${encode(id)}&recipient_id=eq.${encode(userId)}", "PATCH", JSONObject().put("read", true))
    }

    suspend fun deleteNotification(id: String) {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        rest("/rest/v1/notifications?id=eq.${encode(id)}&recipient_id=eq.${encode(userId)}", "DELETE")
    }

    suspend fun loadLeaderboard(timeframe: String = "all", major: String? = null, year: Int? = null): List<LeaderboardUser> {
        val args = JSONObject()
        if (!major.isNullOrBlank()) args.put("_major", major)
        if (year != null) args.put("_year", year)
        val profiles = array(rest("/rest/v1/rpc/get_leaderboard_profiles", "POST", args))
        if (profiles.isEmpty()) return emptyList()
        val adminRows = array(rest("/rest/v1/user_roles?select=user_id&role=in.(admin,sub_admin)"))
        val excluded = adminRows.map { it.optString("user_id") }.toSet()
        val contribution = mutableMapOf<String, Int>()
        if (timeframe == "month" || timeframe == "week") {
            val days = if (timeframe == "week") 7 else 30
            val start = java.time.Instant.now().minusSeconds(days * 86400L).toString()
            val since = encode(start)
            array(rest("/rest/v1/posts?select=author_id&created_at=gte.$since")).forEach { row ->
                val id = row.optStringOrNull("author_id") ?: return@forEach
                contribution[id] = (contribution[id] ?: 0) + 5
            }
            array(rest("/rest/v1/comments?select=author_id&created_at=gte.$since")).forEach { row ->
                val id = row.optStringOrNull("author_id") ?: return@forEach
                contribution[id] = (contribution[id] ?: 0) + 2
            }
        }
        return profiles.mapNotNull { row ->
            val id = row.optString("id")
            if (id.isBlank() || id in excluded) return@mapNotNull null
            val fullName = row.optString("full_name", "مستخدم")
            if (fullName.contains("admin", true) || fullName.contains("مدير") || fullName.contains("ادمن")) return@mapNotNull null
            val points = row.optInt("points")
            val score = if (timeframe == "all") points else contribution[id] ?: 0
            LeaderboardUser(id, fullName, row.optStringOrNull("avatar_url"), points,
                row.optStringOrNull("major"), if (row.isNull("year")) null else row.optInt("year"),
                row.optBoolean("verified"), score, contribution[id] ?: 0)
        }.sortedByDescending { it.score }
    }

    suspend fun loadCourseDetail(courseId: String): CourseDetail {
        val courseRow = array(rest("/rest/v1/courses?select=*&id=eq." + encode(courseId) + "&limit=1")).firstOrNull()
            ?: throw ApiException("هذا المقرر غير متاح أو تم حذفه")
        val linkRows = array(rest("/rest/v1/course_links?select=id,course_id,title,url,link_type,created_by,created_at,is_important&course_id=eq." + encode(courseId) + "&order=is_important.desc,created_at.desc"))
        val updateRows = array(rest("/rest/v1/course_updates?select=id,course_id,author_id,content,created_at&course_id=eq." + encode(courseId) + "&order=created_at.desc"))
        val prefix = "[course:" + courseId + "]"
        val questionRows = array(rest("/rest/v1/posts?select=id,author_id,content,created_at,is_anonymous,post_type&content=" + encode("ilike." + prefix + "%") + "&order=created_at.desc&limit=60"))
        val questionIds = questionRows.mapNotNull { it.optStringOrNull("id") }
        val commentRows = if (questionIds.isEmpty()) emptyList() else array(rest("/rest/v1/comments?select=id,post_id,author_id,content,created_at,is_anonymous&post_id=in.(" + questionIds.joinToString(",") + ")&order=created_at.asc"))
        val authorIds = buildSet {
            courseRow.optStringOrNull("teacher_id")?.let(::add)
            updateRows.forEach { it.optStringOrNull("author_id")?.let(::add) }
            questionRows.forEach { it.optStringOrNull("author_id")?.let(::add) }
            commentRows.forEach { it.optStringOrNull("author_id")?.let(::add) }
        }
        val profiles = publicProfiles(authorIds)
        val teacherId = courseRow.optStringOrNull("teacher_id")
        val course = Course(
            id = courseId, name = courseRow.optString("name"), description = courseRow.optStringOrNull("description"),
            major = courseRow.optString("major"), year = courseRow.optInt("year"), semester = courseRow.optInt("semester"),
            teacherId = teacherId, teacherName = profiles[teacherId]?.fullName, schedule = parseSchedule(courseRow.optJSONArray("schedule"))
        )
        val materials = linkRows.map { materialFrom(it) }
        val commentsByPost = commentRows.groupBy { it.optString("post_id") }
        val questions = questionRows.map { row ->
            val authorId = row.optStringOrNull("author_id")
            val anonymous = row.optBoolean("is_anonymous") || authorId == null
            val replies = commentsByPost[row.optString("id")].orEmpty().map { c ->
                val cAuthor = c.optStringOrNull("author_id")
                val cAnonymous = c.optBoolean("is_anonymous") || cAuthor == null
                CourseComment(c.optString("id"), cAuthor, if (cAnonymous) "طالب مجهول" else profiles[cAuthor]?.fullName ?: "طالب",
                    if (cAnonymous) null else profiles[cAuthor]?.avatarUrl, c.optString("content"), c.optString("created_at"), cAuthor != null && cAuthor == teacherId)
            }
            CourseQuestion(row.optString("id"), authorId, if (anonymous) "طالب مجهول" else profiles[authorId]?.fullName ?: "طالب",
                if (anonymous) null else profiles[authorId]?.avatarUrl, !anonymous && profiles[authorId]?.verified == true,
                row.optString("content").removePrefix(prefix).trim(), row.optString("created_at"), replies)
        }
        val updates = updateRows.map { row ->
            val authorId = row.optStringOrNull("author_id")
            CourseUpdate(row.optString("id"), row.optString("course_id"), profiles[authorId]?.fullName ?: "إدارة المقرر", row.optString("content"), row.optString("created_at"))
        }
        return CourseDetail(course.copy(fileCount = materials.count { it.isFile }, linkCount = materials.count { !it.isFile }),
            materials.filter { it.isFile }, materials.filter { !it.isFile }, questions, updates)
    }

    suspend fun postQuestion(courseId: String, content: String, anonymous: Boolean) {
        rest("/rest/v1/rpc/create_post_as", "POST", JSONObject().put("_content", "[course:" + courseId + "] " + content.trim()).put("_post_type", "question").put("_anonymous", anonymous))
    }

    suspend fun addComment(postId: String, content: String) {
        rest("/rest/v1/rpc/create_comment_as", "POST", JSONObject().put("_post_id", postId).put("_content", content.trim()).put("_parent_id", JSONObject.NULL).put("_anonymous", false))
    }

    suspend fun resolveMaterialUrl(material: CourseMaterial): String {
        if (!material.isFile) return material.url
        val path = Uri.encode(material.url, "/")
        val json = JSONObject(rest("/storage/v1/object/sign/course-files/" + path, "POST", JSONObject().put("expiresIn", 600)))
        val signed = json.optString("signedURL").ifBlank { json.optString("signedUrl") }
        if (signed.isBlank()) throw ApiException("تعذّر إنشاء رابط آمن للملف")
        return if (signed.startsWith("http")) signed else baseUrl + "/storage/v1" + if (signed.startsWith("/")) signed else "/" + signed
    }

    suspend fun recoverPassword(identifier: String) {
        val body = JSONObject().put("email", normalizeLoginIdentifier(identifier))
        execute(Request.Builder().url(baseUrl + "/auth/v1/recover").header("apikey", publishableKey).post(body.toString().toRequestBody(jsonType)).build())
    }

    suspend fun updatePassword(password: String) {
        rest("/auth/v1/user", "PUT", JSONObject().put("password", password))
    }

    suspend fun signOut() {
        try { if (session != null) rest("/auth/v1/logout", "POST", JSONObject()) }
        finally { session = null; store.clear() }
    }

    fun saveThemeMode(mode: ThemeMode) {
        appContext.getSharedPreferences("nexus_preferences", Context.MODE_PRIVATE).edit().putString("theme_mode", mode.name).apply()
    }

    fun loadThemeMode(): ThemeMode = ThemeMode.from(
        appContext.getSharedPreferences("nexus_preferences", Context.MODE_PRIVATE).getString("theme_mode", ThemeMode.SYSTEM.name)
    )

    suspend fun loadCurrentProfile(): StudentProfile {
        val userId = session?.userId?.takeIf { it.isNotBlank() } ?: JSONObject(rest("/auth/v1/user")).optString("id")
        session = session?.copy(userId = userId)
        persistSession()
        return loadProfile(userId)
    }

    private suspend fun loadProfile(userId: String): StudentProfile {
        val row = array(rest("/rest/v1/profiles?select=id,university_number,full_name,major,year,avatar_url,bio,must_change_password,points,banned,suspended_until,theme&id=eq." + encode(userId) + "&limit=1")).firstOrNull()
            ?: throw ApiException("لم يُعثر على ملف الطالب المرتبط بهذا الحساب")
        val roles = array(rest("/rest/v1/user_roles?select=role&user_id=eq.${encode(userId)}")).map { it.optString("role") }.filter(String::isNotBlank)
        val permissionRow = if ("sub_admin" in roles) array(rest("/rest/v1/subadmin_permissions?select=can_warn,can_suspend,can_courses,can_reports,can_words,can_teachers&user_id=eq.${encode(userId)}&limit=1")).firstOrNull() else null
        val permissions = permissionRow?.let { row -> buildSet {
            if (row.optBoolean("can_warn")) add("warn"); if (row.optBoolean("can_suspend")) add("suspend")
            if (row.optBoolean("can_courses")) add("courses"); if (row.optBoolean("can_reports")) add("reports")
            if (row.optBoolean("can_words")) add("words"); if (row.optBoolean("can_teachers")) add("teachers")
        } } ?: emptySet()
        return StudentProfile(row.optString("id"), row.optString("university_number"), row.optString("full_name"),
            row.optStringOrNull("major"), if (row.isNull("year")) null else row.optInt("year"),
            row.optStringOrNull("avatar_url"), row.optStringOrNull("bio"), row.optBoolean("must_change_password"),
            row.optInt("points"), row.optBoolean("banned"), row.optStringOrNull("suspended_until"), row.optString("theme", "stars"), roles, permissions)
    }

    private suspend fun verifyStudentAccess(profile: StudentProfile) {
        if (profile.banned) throw ApiException("هذا الحساب موقوف. راجع إدارة المنصة.")
        val suspended = profile.suspendedUntil?.let {
            runCatching { java.time.Instant.parse(it).epochSecond > System.currentTimeMillis() / 1000L }.getOrDefault(false)
        } ?: false
        if (suspended) throw ApiException("هذا الحساب موقوف مؤقتاً حتى انتهاء مدة الإيقاف.")
        val roles = array(rest("/rest/v1/user_roles?select=role&user_id=eq." + encode(session?.userId ?: profile.id))).map { it.optString("role") }
        if (roles.isEmpty() || roles.any { it !in setOf("student", "teacher", "admin", "sub_admin") }) {
            throw ApiException("هذا الحساب لا يملك دوراً معتمداً في NEXUS.")
        }
    }

    private suspend fun publicProfiles(ids: Set<String>): Map<String, PublicProfile> {
        if (ids.isEmpty()) return emptyMap()
        val idArray = JSONArray()
        ids.forEach { idArray.put(it) }
        val rows = array(rest("/rest/v1/rpc/get_public_profiles", "POST", JSONObject().put("_ids", idArray)))
        return rows.associate { row ->
            val id = row.optString("id")
            id to PublicProfile(id, row.optString("full_name", "مستخدم"), row.optStringOrNull("avatar_url"), row.optBoolean("verified"))
        }
    }

    private suspend fun ensureFreshSession() {
        val current = session ?: throw ApiException("انتهت جلسة الدخول. سجّل الدخول مرة أخرى.")
        if (current.expiresAt > System.currentTimeMillis() / 1000L + 90L) return
        refreshMutex.withLock {
            val latest = session ?: throw ApiException("انتهت جلسة الدخول. سجّل الدخول مرة أخرى.")
            if (latest.expiresAt > System.currentTimeMillis() / 1000L + 90L) return
            val body = JSONObject().put("refresh_token", latest.refreshToken)
            val raw = execute(Request.Builder().url(baseUrl + "/auth/v1/token?grant_type=refresh_token").header("apikey", publishableKey).post(body.toString().toRequestBody(jsonType)).build())
            session = sessionFrom(JSONObject(raw)).copy(userId = latest.userId)
            persistSession()
        }
    }

    private suspend fun rest(path: String, method: String = "GET", body: JSONObject? = null, extraHeaders: Map<String, String> = emptyMap()): String {
        ensureFreshSession()
        val current = session ?: throw ApiException("انتهت جلسة الدخول")
        val builder = Request.Builder().url(baseUrl + path).header("apikey", publishableKey).header("Authorization", "Bearer " + current.accessToken)
        extraHeaders.forEach { (key, value) -> builder.header(key, value) }
        if (method == "GET") builder.get() else builder.method(method, (body ?: JSONObject()).toString().toRequestBody(jsonType))
        return execute(builder.build())
    }

    private suspend fun execute(request: Request): String = withContext(Dispatchers.IO) {
        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw ApiException(errorMessage(raw, response.code), response.code)
            raw
        }
    }

    private fun sessionFrom(json: JSONObject): UserSession {
        val expiresIn = json.optLong("expires_in", 3600L)
        return UserSession(json.optString("access_token"), json.optString("refresh_token"),
            json.optLong("expires_at", System.currentTimeMillis() / 1000L + expiresIn),
            json.optJSONObject("user")?.optString("id").orEmpty())
    }

    private fun persistSession() {
        session?.let { s ->
            store.save(JSONObject().put("access_token", s.accessToken).put("refresh_token", s.refreshToken).put("expires_at", s.expiresAt).put("user_id", s.userId).toString())
        }
    }

    private fun decodeSession(raw: String): UserSession? = runCatching {
        val j = JSONObject(raw)
        UserSession(j.optString("access_token"), j.optString("refresh_token"), j.optLong("expires_at"), j.optString("user_id"))
    }.getOrNull()

    private fun array(raw: String): List<JSONObject> {
        val j = JSONArray(raw)
        return (0 until j.length()).mapNotNull { j.optJSONObject(it) }
    }

    private fun parseSchedule(json: JSONArray?): List<ScheduleEntry> {
        if (json == null) return emptyList()
        return (0 until json.length()).mapNotNull { index ->
            val item = json.optJSONObject(index) ?: return@mapNotNull null
            ScheduleEntry(item.optString("day"), item.optString("start"), item.optString("end"), item.optString("room"))
        }
    }

    private fun materialFrom(row: JSONObject, courseName: String? = null): CourseMaterial {
        val split = row.optString("title").split("|||", limit = 2)
        return CourseMaterial(row.optString("id"), row.optString("course_id"), split.firstOrNull()?.trim().orEmpty(),
            split.getOrNull(1)?.trim()?.takeIf { it.isNotBlank() }, row.optString("url"), row.optStringOrNull("link_type"),
            row.optString("created_at"), row.optBoolean("is_important"), courseName)
    }

    private fun errorMessage(raw: String, code: Int): String = runCatching {
        val j = JSONObject(raw)
        j.optString("msg").ifBlank { j.optString("message").ifBlank { j.optString("error_description").ifBlank { "تعذّر إكمال الطلب ($code)" } } }
    }.getOrDefault("تعذّر الاتصال بالخادم ($code)")

    private fun encode(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8.toString())
    private fun JSONObject.optStringOrNull(key: String): String? {
        if (isNull(key)) return null
        return optString(key).takeIf { it.isNotBlank() && it != "null" }
    }
}
