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

class ApiException(message: String, val statusCode: Int = 0) : Exception(message)

class NexusRepository(context: Context) {
    private val appContext = context.applicationContext
    private val store = SecureSessionStore(appContext)
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()
    private val refreshMutex = Mutex()
    private val baseUrl = com.nexus.app.BuildConfig.SUPABASE_URL.trimEnd('/')
    private val publishableKey = com.nexus.app.BuildConfig.SUPABASE_PUBLISHABLE_KEY
    private var session: UserSession? = store.read()?.let(::decodeSession)

    private val jsonType = "application/json; charset=utf-8".toMediaType()

    suspend fun signIn(identifier: String, password: String): StudentProfile {
        val email = normalizeLoginIdentifier(identifier)
        val body = JSONObject()
            .put("email", email)
            .put("password", password)
        val raw = execute(
            Request.Builder()
                .url(baseUrl + "/auth/v1/token?grant_type=password")
                .header("apikey", publishableKey)
                .post(body.toString().toRequestBody(jsonType))
                .build()
        )
        val payload = JSONObject(raw)
        session = sessionFrom(payload)
        persistSession()
        val profile = loadCurrentProfile()
        verifyStudentAccess(profile)
        return profile
    }

    suspend fun restoreSession(): StudentProfile? {
        if (session == null) {
            session = store.read()?.let(::decodeSession)
        }
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
        session = UserSession(
            accessToken = access,
            refreshToken = refresh,
            expiresAt = System.currentTimeMillis() / 1000L + expiresIn,
            userId = ""
        )
        persistSession()
        return true
    }

    suspend fun loadHome(profile: StudentProfile): Pair<List<Course>, List<CourseMaterial>> {
        val majorFilter = profile.major?.let { "&major=eq." + encode(it) } ?: ""
        val courseRows = array(
            rest(
                "/rest/v1/courses?select=id,name,description,major,year,semester,teacher_id,schedule,created_at,updated_at" +
                    majorFilter + "&order=year.asc,semester.asc,name.asc"
            )
        )
        val teacherIds = courseRows.mapNotNull { it.optStringOrNull("teacher_id") }.toSet()
        val teacherProfiles = publicProfiles(teacherIds)

        val ids = courseRows.mapNotNull { it.optStringOrNull("id") }
        if (ids.isEmpty()) return emptyList<Course>() to emptyList()

        val inFilter = ids.joinToString(",")
        val linkRows = array(
            rest(
                "/rest/v1/course_links?select=id,course_id,link_type,created_at&course_id=in.(" +
                    inFilter + ")&order=created_at.desc"
            )
        )
        val stats = linkRows.groupBy { it.optString("course_id") }
        val courses = courseRows.map { row ->
            val id = row.optString("id")
            val courseLinks = stats[id].orEmpty()
            val fileCount = courseLinks.count { it.optStringOrNull("link_type") == "file" }
            val linkCount = courseLinks.count { it.isNull("link_type") }
            val latest = courseLinks.firstOrNull()?.optStringOrNull("created_at")
            Course(
                id = id,
                name = row.optString("name"),
                description = row.optStringOrNull("description"),
                major = row.optString("major"),
                year = row.optInt("year"),
                semester = row.optInt("semester"),
                teacherId = row.optStringOrNull("teacher_id"),
                teacherName = teacherProfiles[row.optStringOrNull("teacher_id")]?.fullName,
                schedule = parseSchedule(row.optJSONArray("schedule")),
                fileCount = fileCount,
                linkCount = linkCount,
                lastUpdated = latest ?: row.optStringOrNull("updated_at")
            )
        }

        val recentRows = array(
            rest(
                "/rest/v1/course_links?select=id,course_id,title,url,link_type,created_at,is_important" +
                    "&course_id=in.(" + inFilter + ")&order=created_at.desc&limit=8"
            )
        )
        val courseNames = courses.associate { it.id to it.name }
        val recent = recentRows.map { materialFrom(it, courseNames[it.optString("course_id")]) }
        return courses to recent
    }

    suspend fun loadCourseDetail(courseId: String): CourseDetail {
        val courseRows = array(rest("/rest/v1/courses?select=*&id=eq." + encode(courseId) + "&limit=1"))
        val courseRow = courseRows.firstOrNull() ?: throw ApiException("هذا المقرر غير متاح أو تم حذفه")
        val linkRows = array(
            rest(
                "/rest/v1/course_links?select=id,course_id,title,url,link_type,created_by,created_at,is_important" +
                    "&course_id=eq." + encode(courseId) + "&order=is_important.desc,created_at.desc"
            )
        )
        val updateRows = array(
            rest(
                "/rest/v1/course_updates?select=id,course_id,author_id,content,created_at" +
                    "&course_id=eq." + encode(courseId) + "&order=created_at.desc"
            )
        )
        val prefix = "[course:" + courseId + "]"
        val contentFilter = encode("ilike." + prefix + "%")
        val questionRows = array(
            rest(
                "/rest/v1/posts?select=id,author_id,content,created_at,is_anonymous,post_type" +
                    "&content=" + contentFilter + "&order=created_at.desc&limit=60"
            )
        )

        val questionIds = questionRows.mapNotNull { it.optStringOrNull("id") }
        val commentRows = if (questionIds.isEmpty()) emptyList() else array(
            rest(
                "/rest/v1/comments?select=id,post_id,author_id,content,created_at,is_anonymous" +
                    "&post_id=in.(" + questionIds.joinToString(",") + ")&order=created_at.asc"
            )
        )

        val authorIds = buildSet {
            courseRow.optStringOrNull("teacher_id")?.let(::add)
            updateRows.forEach { it.optStringOrNull("author_id")?.let(::add) }
            questionRows.forEach { it.optStringOrNull("author_id")?.let(::add) }
            commentRows.forEach { it.optStringOrNull("author_id")?.let(::add) }
        }
        val profiles = publicProfiles(authorIds)
        val teacherId = courseRow.optStringOrNull("teacher_id")
        val course = Course(
            id = courseId,
            name = courseRow.optString("name"),
            description = courseRow.optStringOrNull("description"),
            major = courseRow.optString("major"),
            year = courseRow.optInt("year"),
            semester = courseRow.optInt("semester"),
            teacherId = teacherId,
            teacherName = profiles[teacherId]?.fullName,
            schedule = parseSchedule(courseRow.optJSONArray("schedule"))
        )
        val materials = linkRows.map { materialFrom(it) }
        val commentsByPost = commentRows.groupBy { it.optString("post_id") }
        val questions = questionRows.map { row ->
            val authorId = row.optStringOrNull("author_id")
            val isAnonymous = row.optBoolean("is_anonymous") || authorId == null
            val comments = commentsByPost[row.optString("id")].orEmpty().map { comment ->
                val commentAuthorId = comment.optStringOrNull("author_id")
                val anonymous = comment.optBoolean("is_anonymous") || commentAuthorId == null
                CourseComment(
                    id = comment.optString("id"),
                    authorId = commentAuthorId,
                    authorName = if (anonymous) "طالب مجهول" else profiles[commentAuthorId]?.fullName ?: "طالب",
                    avatarUrl = if (anonymous) null else profiles[commentAuthorId]?.avatarUrl,
                    content = comment.optString("content"),
                    createdAt = comment.optString("created_at"),
                    isTeacher = commentAuthorId != null && commentAuthorId == teacherId
                )
            }
            CourseQuestion(
                id = row.optString("id"),
                authorId = authorId,
                authorName = if (isAnonymous) "طالب مجهول" else profiles[authorId]?.fullName ?: "طالب",
                avatarUrl = if (isAnonymous) null else profiles[authorId]?.avatarUrl,
                verified = if (isAnonymous) false else profiles[authorId]?.verified == true,
                content = row.optString("content").removePrefix(prefix).trim(),
                createdAt = row.optString("created_at"),
                replies = comments
            )
        }
        val updates = updateRows.map { row ->
            val authorId = row.optStringOrNull("author_id")
            CourseUpdate(
                id = row.optString("id"),
                courseId = row.optString("course_id"),
                authorName = profiles[authorId]?.fullName ?: "إدارة المقرر",
                content = row.optString("content"),
                createdAt = row.optString("created_at")
            )
        }
        return CourseDetail(
            course = course.copy(fileCount = materials.count { it.isFile }, linkCount = materials.count { !it.isFile }),
            files = materials.filter { it.isFile },
            links = materials.filter { !it.isFile },
            questions = questions,
            updates = updates
        )
    }

    suspend fun postQuestion(courseId: String, content: String, anonymous: Boolean) {
        val body = JSONObject()
            .put("_content", "[course:" + courseId + "] " + content.trim())
            .put("_post_type", "question")
            .put("_anonymous", anonymous)
        rest("/rest/v1/rpc/create_post_as", "POST", body)
    }

    suspend fun addComment(postId: String, content: String) {
        val body = JSONObject()
            .put("_post_id", postId)
            .put("_content", content.trim())
            .put("_parent_id", JSONObject.NULL)
            .put("_anonymous", false)
        rest("/rest/v1/rpc/create_comment_as", "POST", body)
    }

    suspend fun resolveMaterialUrl(material: CourseMaterial): String {
        if (!material.isFile) return material.url
        val path = Uri.encode(material.url, "/")
        val body = JSONObject().put("expiresIn", 600)
        val raw = rest("/storage/v1/object/sign/course-files/" + path, "POST", body)
        val signed = JSONObject(raw).optString("signedURL")
            .ifBlank { JSONObject(raw).optString("signedUrl") }
        if (signed.isBlank()) throw ApiException("تعذّر إنشاء رابط آمن للملف")
        return if (signed.startsWith("http")) signed else baseUrl + "/storage/v1" + if (signed.startsWith("/")) signed else "/" + signed
    }

    suspend fun recoverPassword(identifier: String) {
        val email = normalizeLoginIdentifier(identifier)
        val body = JSONObject().put("email", email)
        execute(
            Request.Builder()
                .url(baseUrl + "/auth/v1/recover")
                .header("apikey", publishableKey)
                .post(body.toString().toRequestBody(jsonType))
                .build()
        )
    }

    suspend fun updatePassword(password: String) {
        rest("/auth/v1/user", "PUT", JSONObject().put("password", password))
    }

    suspend fun signOut() {
        try {
            if (session != null) rest("/auth/v1/logout", "POST", JSONObject())
        } finally {
            session = null
            store.clear()
        }
    }

    fun saveThemeMode(mode: ThemeMode) {
        appContext.getSharedPreferences("nexus_preferences", Context.MODE_PRIVATE)
            .edit().putString("theme_mode", mode.name).apply()
    }

    fun loadThemeMode(): ThemeMode {
        val value = appContext.getSharedPreferences("nexus_preferences", Context.MODE_PRIVATE)
            .getString("theme_mode", ThemeMode.SYSTEM.name)
        return ThemeMode.from(value)
    }

    private suspend fun loadCurrentProfile(): StudentProfile {
        val userId = session?.userId?.takeIf { it.isNotBlank() }
            ?: JSONObject(rest("/auth/v1/user")).optString("id")
        session = session?.copy(userId = userId)
        persistSession()
        return loadProfile(userId)
    }

    private suspend fun loadProfile(userId: String): StudentProfile {
        val rows = array(
            rest(
                "/rest/v1/profiles?select=id,university_number,full_name,major,year,avatar_url,bio,must_change_password,points,banned,suspended_until" +
                    "&id=eq." + encode(userId) + "&limit=1"
            )
        )
        val row = rows.firstOrNull() ?: throw ApiException("لم يُعثر على ملف الطالب المرتبط بهذا الحساب")
        return StudentProfile(
            id = row.optString("id"),
            universityNumber = row.optString("university_number"),
            fullName = row.optString("full_name"),
            major = row.optStringOrNull("major"),
            year = if (row.isNull("year")) null else row.optInt("year"),
            avatarUrl = row.optStringOrNull("avatar_url"),
            bio = row.optStringOrNull("bio"),
            mustChangePassword = row.optBoolean("must_change_password"),
            points = row.optInt("points"),
            banned = row.optBoolean("banned"),
            suspendedUntil = row.optStringOrNull("suspended_until")
        )
    }

    private suspend fun verifyStudentAccess(profile: StudentProfile) {
        if (profile.banned) throw ApiException("هذا الحساب موقوف. راجع إدارة المنصة.")
        val suspended = profile.suspendedUntil?.let {
            runCatching { java.time.Instant.parse(it).epochSecond > System.currentTimeMillis() / 1000L }.getOrDefault(false)
        } ?: false
        if (suspended) throw ApiException("هذا الحساب موقوف مؤقتاً حتى انتهاء مدة الإيقاف.")
        val userId = session?.userId ?: profile.id
        val roles = array(rest("/rest/v1/user_roles?select=role&user_id=eq." + encode(userId)))
            .map { it.optString("role") }
        if (!roles.contains("student") || roles.any { it == "teacher" || it == "admin" || it == "sub_admin" }) {
            throw ApiException("الإصدار الأول من NEXUS مخصص لحسابات الطلاب فقط.")
        }
    }

    private suspend fun publicProfiles(ids: Set<String>): Map<String, PublicProfile> {
        if (ids.isEmpty()) return emptyMap()
        val array = JSONArray()
        ids.forEach { array.put(it) }
        val raw = rest("/rest/v1/rpc/get_public_profiles", "POST", JSONObject().put("_ids", array))
        val rows = array(raw)
        return rows.associate { row ->
            val id = row.optString("id")
            id to PublicProfile(
                id = id,
                fullName = row.optString("full_name", "مستخدم"),
                avatarUrl = row.optStringOrNull("avatar_url"),
                verified = row.optBoolean("verified")
            )
        }
    }

    private suspend fun ensureFreshSession() {
        val current = session ?: throw ApiException("انتهت جلسة الدخول. سجّل الدخول مرة أخرى.")
        if (current.expiresAt > System.currentTimeMillis() / 1000L + 90L) return
        refreshMutex.withLock {
            val latest = session ?: throw ApiException("انتهت جلسة الدخول. سجّل الدخول مرة أخرى.")
            if (latest.expiresAt > System.currentTimeMillis() / 1000L + 90L) return
            val body = JSONObject().put("refresh_token", latest.refreshToken)
            val raw = execute(
                Request.Builder()
                    .url(baseUrl + "/auth/v1/token?grant_type=refresh_token")
                    .header("apikey", publishableKey)
                    .post(body.toString().toRequestBody(jsonType))
                    .build()
            )
            session = sessionFrom(JSONObject(raw)).copy(userId = latest.userId)
            persistSession()
        }
    }

    private suspend fun rest(path: String, method: String = "GET", body: JSONObject? = null): String {
        ensureFreshSession()
        val current = session ?: throw ApiException("انتهت جلسة الدخول")
        val builder = Request.Builder()
            .url(baseUrl + path)
            .header("apikey", publishableKey)
            .header("Authorization", "Bearer " + current.accessToken)
        if (method == "GET") {
            builder.get()
        } else {
            builder.method(method, (body ?: JSONObject()).toString().toRequestBody(jsonType))
        }
        return execute(builder.build())
    }

    private suspend fun execute(request: Request): String = withContext(Dispatchers.IO) {
        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw ApiException(errorMessage(raw, response.code), response.code)
            }
            raw
        }
    }

    private fun sessionFrom(json: JSONObject): UserSession {
        val expiresIn = json.optLong("expires_in", 3600L)
        return UserSession(
            accessToken = json.optString("access_token"),
            refreshToken = json.optString("refresh_token"),
            expiresAt = json.optLong("expires_at", System.currentTimeMillis() / 1000L + expiresIn),
            userId = json.optJSONObject("user")?.optString("id").orEmpty()
        )
    }

    private fun persistSession() {
        session?.let { current ->
            store.save(
                JSONObject()
                    .put("access_token", current.accessToken)
                    .put("refresh_token", current.refreshToken)
                    .put("expires_at", current.expiresAt)
                    .put("user_id", current.userId)
                    .toString()
            )
        }
    }

    private fun decodeSession(raw: String): UserSession? = runCatching {
        val json = JSONObject(raw)
        UserSession(
            accessToken = json.optString("access_token"),
            refreshToken = json.optString("refresh_token"),
            expiresAt = json.optLong("expires_at"),
            userId = json.optString("user_id")
        )
    }.getOrNull()

    private fun array(raw: String): List<JSONObject> {
        val json = JSONArray(raw)
        return (0 until json.length()).mapNotNull { json.optJSONObject(it) }
    }

    private fun parseSchedule(json: JSONArray?): List<ScheduleEntry> {
        if (json == null) return emptyList()
        return (0 until json.length()).mapNotNull { index ->
            val item = json.optJSONObject(index) ?: return@mapNotNull null
            ScheduleEntry(
                day = item.optString("day"),
                start = item.optString("start"),
                end = item.optString("end"),
                room = item.optString("room")
            )
        }
    }

    private fun materialFrom(row: JSONObject, courseName: String? = null): CourseMaterial {
        val rawTitle = row.optString("title")
        val split = rawTitle.split("|||", limit = 2)
        return CourseMaterial(
            id = row.optString("id"),
            courseId = row.optString("course_id"),
            title = split.firstOrNull()?.trim().orEmpty(),
            note = split.getOrNull(1)?.trim()?.takeIf { it.isNotBlank() },
            url = row.optString("url"),
            linkType = row.optStringOrNull("link_type"),
            createdAt = row.optString("created_at"),
            important = row.optBoolean("is_important"),
            courseName = courseName
        )
    }

    private fun errorMessage(raw: String, code: Int): String {
        return runCatching {
            val json = JSONObject(raw)
            json.optString("msg").ifBlank {
                json.optString("message").ifBlank {
                    json.optString("error_description").ifBlank { "تعذّر إكمال الطلب ($code)" }
                }
            }
        }.getOrDefault("تعذّر الاتصال بالخادم ($code)")
    }

    private fun encode(value: String): String =
        URLEncoder.encode(value, StandardCharsets.UTF_8.toString())

    private fun JSONObject.optStringOrNull(key: String): String? {
        if (isNull(key)) return null
        return optString(key).takeIf { it.isNotBlank() && it != "null" }
    }
}
