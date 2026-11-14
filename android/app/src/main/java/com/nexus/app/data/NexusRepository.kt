package com.nexus.app.data

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
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
import java.util.UUID
import java.util.concurrent.TimeUnit

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

    suspend fun loadFeed(filter: String = "all", tag: String? = null): List<FeedPost> {
        ensureFreshSession()
        val cleanTag = tag?.replace(Regex("[^\\p{L}\\p{N}_-]"), "")?.take(40)?.takeIf { it.isNotBlank() }
        var query = "/rest/v1/posts?select=id,author_id,content,images,created_at,is_anonymous,post_type,accepted_answer_id&order=created_at.desc&limit=50"
        query += "&content=" + encode("not.ilike.[course:%")
        when (filter) {
            "open_questions" -> query += "&post_type=eq.question&accepted_answer_id=is.null"
            "solved_questions" -> query += "&post_type=eq.question&accepted_answer_id=not.is.null"
        }
        if (cleanTag != null) query += "&content=" + encode("ilike.%#${cleanTag}%")
        val rows = array(rest(query))
        if (rows.isEmpty()) return emptyList()

        val postIds = rows.mapNotNull { it.optStringOrNull("id") }
        val authorIds = rows.mapNotNull { it.optStringOrNull("author_id") }.toSet()
        val currentUserId = session?.userId.orEmpty()

        return coroutineScope {
            val profilesTask = async { publicProfiles(authorIds) }
            val reactionsTask = async {
                array(rest("/rest/v1/post_reactions?select=post_id,user_id,reaction&post_id=in.(" + postIds.joinToString(",") + ")&limit=5000"))
            }
            val commentsTask = async {
                array(rest("/rest/v1/comments?select=post_id&post_id=in.(" + postIds.joinToString(",") + ")&limit=5000"))
            }
            val savedTask = async {
                if (currentUserId.isBlank()) emptySet<String>()
                else array(rest("/rest/v1/saved_posts?select=post_id&user_id=eq." + encode(currentUserId) + "&post_id=in.(" + postIds.joinToString(",") + ")"))
                    .mapNotNull { it.optStringOrNull("post_id") }.toSet()
            }
            val profiles = profilesTask.await()
            val reactionRows = reactionsTask.await()
            val commentCounts = commentsTask.await().groupingBy { it.optString("post_id") }.eachCount()
            val savedIds = savedTask.await()
            val reactionsByPost = reactionRows.groupBy { it.optString("post_id") }

            rows.map { row ->
                val id = row.optString("id")
                val authorId = row.optStringOrNull("author_id")
                val anonymous = row.optBoolean("is_anonymous") || authorId == null
                val author = profiles[authorId]
                val postReactions = reactionsByPost[id].orEmpty().map {
                    FeedReaction(it.optString("user_id"), it.optString("reaction"))
                }
                val imageArray = row.optJSONArray("images")
                val imagePaths = if (imageArray == null) emptyList() else
                    (0 until imageArray.length()).mapNotNull { index ->
                        imageArray.optString(index).takeIf { it.isNotBlank() && it != "null" }
                    }
                FeedPost(
                    id = id,
                    authorId = authorId,
                    authorName = if (anonymous) "طالب مجهول" else author?.fullName ?: "طالب",
                    avatarUrl = if (anonymous) null else author?.avatarUrl,
                    anonymous = anonymous,
                    content = row.optString("content"),
                    postType = row.optString("post_type", "general"),
                    createdAt = row.optString("created_at"),
                    commentsCount = commentCounts[id] ?: 0,
                    images = imagePaths,
                    acceptedAnswerId = row.optStringOrNull("accepted_answer_id"),
                    authorMajor = if (anonymous) null else author?.major,
                    authorPoints = if (anonymous) 0 else author?.points ?: 0,
                    authorVerified = !anonymous && author?.verified == true,
                    reactions = postReactions,
                    myReaction = postReactions.firstOrNull { it.userId == currentUserId }?.reaction,
                    saved = savedIds.contains(id)
                )
            }
        }
    }

    suspend fun createFeedPost(content: String, anonymous: Boolean, question: Boolean = false, images: List<String> = emptyList()) {
        rest("/rest/v1/rpc/create_post_as", "POST", JSONObject()
            .put("_content", content.trim())
            .put("_images", JSONArray(images))
            .put("_post_type", if (question) "question" else "general")
            .put("_anonymous", anonymous))
    }

    suspend fun uploadPostImage(uri: Uri): String {
        ensureFreshSession()
        val current = session ?: throw ApiException("انتهت جلسة الدخول")
        val mime = appContext.contentResolver.getType(uri) ?: "image/jpeg"
        if (!mime.startsWith("image/")) throw ApiException("الملف المحدد ليس صورة")
        val bytes = withContext(Dispatchers.IO) {
            appContext.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        } ?: throw ApiException("تعذّر قراءة الصورة")
        if (bytes.size > 8 * 1024 * 1024) throw ApiException("حجم الصورة يتجاوز 8 ميغابايت")
        val extension = when (mime.lowercase()) {
            "image/png" -> "png"
            "image/webp" -> "webp"
            "image/gif" -> "gif"
            "image/heic", "image/heif" -> "heic"
            else -> "jpg"
        }
        val path = current.userId + "/" + UUID.randomUUID() + "." + extension
        val request = Request.Builder()
            .url(baseUrl + "/storage/v1/object/post-images/" + Uri.encode(path, "/"))
            .header("apikey", publishableKey)
            .header("Authorization", "Bearer " + current.accessToken)
            .header("Content-Type", mime)
            .header("x-upsert", "false")
            .post(bytes.toRequestBody(mime.toMediaType()))
            .build()
        execute(request)
        return path
    }

    suspend fun removePostImage(path: String) {
        rest("/storage/v1/object/post-images/" + Uri.encode(path, "/"), "DELETE")
    }

    suspend fun resolvePostImageUrl(path: String): String {
        val json = JSONObject(rest("/storage/v1/object/sign/post-images/" + Uri.encode(path, "/"), "POST", JSONObject().put("expiresIn", 600)))
        val signed = json.optString("signedURL").ifBlank { json.optString("signedUrl") }
        if (signed.isBlank()) throw ApiException("تعذّر تحميل صورة المنشور")
        return if (signed.startsWith("http")) signed else baseUrl + "/storage/v1" + if (signed.startsWith("/")) signed else "/" + signed
    }

    suspend fun setPostReaction(postId: String, reaction: String?) {
        val userId = session?.userId?.takeIf { it.isNotBlank() } ?: throw ApiException("انتهت جلسة الدخول")
        val filter = "?post_id=eq." + encode(postId) + "&user_id=eq." + encode(userId)
        if (reaction == null) {
            rest("/rest/v1/post_reactions" + filter, "DELETE")
        } else {
            rest("/rest/v1/post_reactions?on_conflict=post_id,user_id", "POST",
                JSONObject().put("post_id", postId).put("user_id", userId).put("reaction", reaction),
                "resolution=merge-duplicates,return=minimal")
        }
    }

    suspend fun toggleSavedPost(postId: String, saved: Boolean) {
        val userId = session?.userId?.takeIf { it.isNotBlank() } ?: throw ApiException("انتهت جلسة الدخول")
        if (saved) {
            rest("/rest/v1/saved_posts", "POST", JSONObject().put("post_id", postId).put("user_id", userId))
        } else {
            rest("/rest/v1/saved_posts?post_id=eq." + encode(postId) + "&user_id=eq." + encode(userId), "DELETE")
        }
    }

    suspend fun deletePost(postId: String) {
        rest("/rest/v1/posts?id=eq." + encode(postId), "DELETE")
    }

    suspend fun reportPost(postId: String, reason: String) {
        val userId = session?.userId?.takeIf { it.isNotBlank() } ?: throw ApiException("انتهت جلسة الدخول")
        rest("/rest/v1/post_reports", "POST",
            JSONObject().put("post_id", postId).put("reporter_id", userId).put("reason", reason))
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
        val redirect = Uri.parse(com.nexus.app.BuildConfig.WEB_AUTH_URL.trimEnd('/') + "/reset-password")
            .buildUpon()
            .appendQueryParameter("redirect_to", "com.nexus.app://login-callback")
            .build()
            .toString()
        val requestUrl = baseUrl + "/auth/v1/recover?redirect_to=" + encode(redirect)
        execute(Request.Builder().url(requestUrl).header("apikey", publishableKey).post(body.toString().toRequestBody(jsonType)).build())
    }

    suspend fun updatePassword(password: String) {
        rest("/auth/v1/user", "PUT", JSONObject().put("password", password))
    }

    suspend fun saveProfileCardTheme(themeId: String) {
        if (ProfileThemeRules.minimumPoints(themeId) == null) throw ApiException("المظهر غير صالح")
        val userId = session?.userId?.takeIf { it.isNotBlank() } ?: throw ApiException("انتهت جلسة الدخول")
        rest("/rest/v1/profiles?id=eq." + encode(userId), "PATCH", JSONObject().put("card_theme_id", themeId))
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

    private suspend fun loadCurrentProfile(): StudentProfile {
        val userId = session?.userId?.takeIf { it.isNotBlank() } ?: JSONObject(rest("/auth/v1/user")).optString("id")
        session = session?.copy(userId = userId)
        persistSession()
        return loadProfile(userId)
    }

    private suspend fun loadProfile(userId: String): StudentProfile {
        val row = array(rest("/rest/v1/profiles?select=id,university_number,full_name,major,year,avatar_url,bio,must_change_password,points,banned,suspended_until,card_theme_id&id=eq." + encode(userId) + "&limit=1")).firstOrNull()
            ?: throw ApiException("لم يُعثر على ملف الطالب المرتبط بهذا الحساب")
        return StudentProfile(row.optString("id"), row.optString("university_number"), row.optString("full_name"),
            row.optStringOrNull("major"), if (row.isNull("year")) null else row.optInt("year"),
            row.optStringOrNull("avatar_url"), row.optStringOrNull("bio"), row.optBoolean("must_change_password"),
            row.optInt("points"), row.optBoolean("banned"), row.optStringOrNull("suspended_until"), row.optStringOrNull("card_theme_id"))
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
            id to PublicProfile(id, row.optString("full_name", "مستخدم"), row.optStringOrNull("avatar_url"), row.optBoolean("verified"), row.optStringOrNull("major"), row.optInt("points"))
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

    private suspend fun rest(path: String, method: String = "GET", body: JSONObject? = null, prefer: String? = null): String {
        ensureFreshSession()
        val current = session ?: throw ApiException("انتهت جلسة الدخول")
        val builder = Request.Builder().url(baseUrl + path).header("apikey", publishableKey).header("Authorization", "Bearer " + current.accessToken)
        if (prefer != null) builder.header("Prefer", prefer)
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
