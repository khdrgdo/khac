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
            runCatching {
                val post = array(rest("/rest/v1/posts?select=author_id&id=eq." + encode(postId))).firstOrNull()
                val authorId = post?.optStringOrNull("author_id")
                if (authorId != null) notifyUser(authorId, "post_like", "تفاعل جديد على منشورك", "قام أحد زملائك بالتفاعل على منشورك.", "/posts/" + postId)
            }
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

suspend fun loadPostComments(postId: String): List<FeedComment> {
        val rows = array(rest("/rest/v1/comments?select=id,post_id,author_id,content,created_at,is_anonymous,parent_id&post_id=eq." + encode(postId) + "&order=created_at.asc&limit=200"))
        val authorIds = rows.mapNotNull { it.optStringOrNull("author_id") }.toSet()
        val profiles = publicProfiles(authorIds)
        return rows.map { row ->
            val authorId = row.optStringOrNull("author_id")
            val anonymous = row.optBoolean("is_anonymous") || authorId == null
            val author = profiles[authorId]
            FeedComment(
                id = row.optString("id"), postId = row.optString("post_id"), authorId = authorId,
                authorName = if (anonymous) "طالب مجهول" else author?.fullName ?: "طالب",
                avatarUrl = if (anonymous) null else author?.avatarUrl, anonymous = anonymous,
                content = row.optString("content"), createdAt = row.optString("created_at"),
                parentId = row.optStringOrNull("parent_id")
            )
        }
    }

    /** Resolves a batch of user ids to display names/avatars — used for the "who reacted" sheet. */
    suspend fun resolveProfiles(ids: Set<String>): Map<String, PublicProfile> = publicProfiles(ids)

        suspend fun addComment(postId: String, content: String) {
        rest("/rest/v1/rpc/create_comment_as", "POST", JSONObject().put("_post_id", postId).put("_content", content.trim()).put("_parent_id", JSONObject.NULL).put("_anonymous", false))
        runCatching {
            val post = array(rest("/rest/v1/posts?select=author_id&id=eq." + encode(postId))).firstOrNull()
            val authorId = post?.optStringOrNull("author_id")
            if (authorId != null) notifyUser(authorId, "post_comment", "تعليق جديد على منشورك", content.trim().take(120), "/posts/" + postId)
        }
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
        val row = array(rest("/rest/v1/profiles?select=id,university_number,full_name,major,year,avatar_url,bio,must_change_password,points,banned,suspended_until,card_theme_id,hide_university_number,verified,warning_count&id=eq." + encode(userId) + "&limit=1")).firstOrNull()
            ?: throw ApiException("لم يُعثر على ملف الطالب المرتبط بهذا الحساب")
        val rawAvatar = row.optStringOrNull("avatar_url")
        val avatar = if (rawAvatar.isNullOrBlank() || rawAvatar.startsWith("http")) rawAvatar
            else resolveStorageUrls("avatars", listOf(rawAvatar))[rawAvatar] ?: rawAvatar
        return StudentProfile(
            row.optString("id"),
            row.optString("university_number"),
            row.optString("full_name"),
            row.optStringOrNull("major"),
            if (row.isNull("year")) null else row.optInt("year"),
            avatar,
            row.optStringOrNull("bio"),
            row.optBoolean("must_change_password"),
            row.optInt("points"),
            row.optBoolean("banned"),
            row.optStringOrNull("suspended_until"),
            row.optStringOrNull("card_theme_id"),
            row.optBoolean("hide_university_number"),
            false, // "has_used_direct_name_change" has no column in the live schema; see docs/ANDROID_REBUILD_PLAN.md
            row.optBoolean("verified"),
            row.optInt("warning_count")
        )
    }

    suspend fun loadProfileStats(userId: String): ProfileStats = coroutineScope {
        val postsTask = async { array(rest("/rest/v1/posts?select=id,created_at&author_id=eq." + encode(userId) + "&limit=5000")) }
        val commentsTask = async { array(rest("/rest/v1/comments?select=id,created_at&author_id=eq." + encode(userId) + "&limit=5000")) }
        val savedTask = async { array(rest("/rest/v1/saved_posts?select=id&user_id=eq." + encode(userId) + "&limit=5000")) }
        val posts = postsTask.await()
        val comments = commentsTask.await()
        val saved = savedTask.await()
        val commentIds = comments.mapNotNull { it.optStringOrNull("id") }
        val acceptedCount = if (commentIds.isEmpty()) 0 else {
            commentIds.chunked(100).sumOf { chunk ->
                val ids = chunk.joinToString(",")
                array(rest("/rest/v1/posts?select=id&accepted_answer_id=in.(" + ids + ")&limit=5000")).size
            }
        }
        val dates = (posts + comments).mapNotNull { it.optStringOrNull("created_at")?.take(10) }
        ProfileStats(posts.size, comments.size, saved.size, acceptedCount, dates)
    }

    suspend fun updateProfileBio(userId: String, bio: String?) {
        rest("/rest/v1/profiles?id=eq." + encode(userId), "PATCH", JSONObject().put("bio", bio?.trim()?.takeIf { it.isNotBlank() } ?: JSONObject.NULL))
    }

    suspend fun updateProfileName(userId: String, name: String) {
        // "has_used_direct_name_change" has no column in the live schema (see docs/ANDROID_REBUILD_PLAN.md),
        // so the one-time-direct-change gate cannot be persisted server-side yet; only the name itself is saved.
        rest("/rest/v1/profiles?id=eq." + encode(userId), "PATCH",
            JSONObject().put("full_name", name.trim()))
    }

    suspend fun submitNameChangeRequest(userId: String, currentName: String, requestedName: String, reason: String, contactInfo: String, universityNumber: String) {
        rest("/rest/v1/name_change_requests", "POST", JSONObject()
            .put("user_id", userId)
            .put("current_name", currentName)
            .put("requested_name", requestedName.trim())
            .put("reason", reason.trim())
            .put("contact_info", contactInfo.trim())
            .put("university_number", universityNumber)
            .put("status", "pending"))
    }

    suspend fun toggleUniversityNumberPrivacy(userId: String, hidden: Boolean) {
        rest("/rest/v1/profiles?id=eq." + encode(userId), "PATCH", JSONObject().put("hide_university_number", hidden))
    }

    suspend fun uploadProfileAvatar(uri: Uri, userId: String) {
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
        val path = userId + "/avatar-" + UUID.randomUUID() + "." + extension
        val request = Request.Builder()
            .url(baseUrl + "/storage/v1/object/avatars/" + Uri.encode(path, "/"))
            .header("apikey", publishableKey)
            .header("Authorization", "Bearer " + current.accessToken)
            .header("Content-Type", mime)
            .header("x-upsert", "false")
            .post(bytes.toRequestBody(mime.toMediaType()))
            .build()
        execute(request)
        rest("/rest/v1/profiles?id=eq." + encode(userId), "PATCH", JSONObject().put("avatar_url", path))
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


    // ---------------------------------------------------------------------
    // Messaging
    // ---------------------------------------------------------------------

    suspend fun loadConversations(): MessagingState {
        val userId = session?.userId.orEmpty()
        if (userId.isBlank()) return MessagingState()
        val convos = array(rest("/rest/v1/conversation_members?select=conversation_id,conversations(id,is_group,name,updated_at)&user_id=eq." + encode(userId)))
        val convIds = convos.mapNotNull { it.optJSONObject("conversations")?.optString("id") }.distinct()
        if (convIds.isEmpty()) return MessagingState(unreadTotal = 0)

        return coroutineScope {
            val membersTask = async {
                array(rest("/rest/v1/conversation_members?select=conversation_id,user_id&conversation_id=in.(" + convIds.joinToString(",") + ")"))
            }
            val lastMsgTask = async {
                array(rest("/rest/v1/messages?select=conversation_id,content,created_at&conversation_id=in.(" + convIds.joinToString(",") + ")&order=created_at.desc&limit=400"))
            }
            val unreadTask = async {
                array(rest("/rest/v1/rpc/get_conversation_unread_counts", "POST", JSONObject().put("_user_id", userId)))
            }
            val blockedTask = async {
                array(rest("/rest/v1/blocked_users?select=blocked_id&blocker_id=eq." + encode(userId)))
                    .mapNotNull { it.optStringOrNull("blocked_id") }.toSet()
            }

            val memberRows = membersTask.await()
            val otherIdByConv = memberRows.groupBy { it.optString("conversation_id") }
                .mapValues { (_, rows) -> rows.map { it.optString("user_id") }.firstOrNull { it != userId } }
            val otherIds = otherIdByConv.values.filterNotNull().toSet()
            val profiles = publicProfiles(otherIds)
            val lastByConv = lastMsgTask.await().groupBy { it.optString("conversation_id") }
                .mapValues { (_, rows) -> rows.maxByOrNull { it.optString("created_at") } }
            val unreadByConv = unreadTask.await().associate { it.optString("conversation_id") to it.optInt("unread_count") }
            val blocked = blockedTask.await()

            val summaries = convos.mapNotNull { row ->
                val conv = row.optJSONObject("conversations") ?: return@mapNotNull null
                val id = conv.optString("id")
                val isGroup = conv.optBoolean("is_group")
                val otherId = otherIdByConv[id]
                val title = if (isGroup) conv.optStringOrNull("name") ?: "مجموعة" else profiles[otherId]?.fullName ?: "مستخدم"
                ConversationSummary(
                    id = id,
                    isGroup = isGroup,
                    title = title,
                    avatarUrl = if (isGroup) null else profiles[otherId]?.avatarUrl,
                    otherUserId = otherId,
                    lastMessage = lastByConv[id]?.optStringOrNull("content"),
                    lastMessageAt = lastByConv[id]?.optStringOrNull("created_at") ?: conv.optStringOrNull("updated_at"),
                    unreadCount = unreadByConv[id] ?: 0,
                    blocked = otherId != null && blocked.contains(otherId)
                )
            }.sortedByDescending { it.lastMessageAt ?: "" }

            MessagingState(conversations = summaries, unreadTotal = summaries.sumOf { it.unreadCount })
        }
    }

    suspend fun loadMessages(conversationId: String): List<ChatMessage> {
        val rows = array(rest("/rest/v1/messages?select=id,conversation_id,sender_id,content,created_at&conversation_id=eq." + encode(conversationId) + "&order=created_at.asc&limit=500"))
        val senderIds = rows.mapNotNull { it.optStringOrNull("sender_id") }.toSet()
        val profiles = publicProfiles(senderIds)
        return rows.map { row ->
            val senderId = row.optString("sender_id")
            ChatMessage(
                id = row.optString("id"),
                conversationId = row.optString("conversation_id"),
                senderId = senderId,
                senderName = profiles[senderId]?.fullName ?: "مستخدم",
                senderAvatar = profiles[senderId]?.avatarUrl,
                content = row.optString("content"),
                createdAt = row.optString("created_at")
            )
        }
    }

    suspend fun sendMessage(conversationId: String, otherUserId: String?, content: String) {
        val userId = session?.userId?.takeIf { it.isNotBlank() } ?: throw ApiException("انتهت جلسة الدخول")
        if (otherUserId != null) {
            val blocked = array(rest("/rest/v1/blocked_users?select=blocked_id&blocker_id=eq." + encode(userId) + "&blocked_id=eq." + encode(otherUserId)))
            if (blocked.isNotEmpty()) throw ApiException("لا يمكنك إرسال رسالة؛ لقد حظرت هذا المستخدم.")
        }
        val member = array(rest("/rest/v1/conversation_members?select=conversation_id&conversation_id=eq." + encode(conversationId) + "&user_id=eq." + encode(userId)))
        if (member.isEmpty()) {
            rest("/rest/v1/conversation_members", "POST", JSONObject().put("conversation_id", conversationId).put("user_id", userId))
        }
        rest("/rest/v1/messages", "POST", JSONObject().put("conversation_id", conversationId).put("sender_id", userId).put("content", content.trim()))
        runCatching {
            rest("/rest/v1/conversations?id=eq." + encode(conversationId), "PATCH", JSONObject().put("updated_at", java.time.Instant.now().toString()))
        }
    }

    /**
     * Mirrors the web client's getOrCreateDM: the "create_dm" RPC exists on some environments but
     * not reliably (it is absent from the generated schema types), so every step here has a fallback
     * rather than assuming the RPC succeeded.
     */
    suspend fun openDirectConversation(otherUserId: String): String {
        val userId = session?.userId?.takeIf { it.isNotBlank() } ?: throw ApiException("انتهت جلسة الدخول")
        if (userId == otherUserId) throw ApiException("لا يمكنك مراسلة نفسك")

        runCatching {
            val raw = rest("/rest/v1/rpc/create_dm", "POST", JSONObject().put("_other", otherUserId))
            val id = parseScalar(raw)
            if (id.isNotBlank() && id != "null") return id
        }

        val myConvIds = array(rest("/rest/v1/conversation_members?select=conversation_id&user_id=eq." + encode(userId)))
            .mapNotNull { it.optStringOrNull("conversation_id") }
        if (myConvIds.isNotEmpty()) {
            val sharedIds = array(rest("/rest/v1/conversation_members?select=conversation_id&user_id=eq." + encode(otherUserId) + "&conversation_id=in.(" + myConvIds.joinToString(",") + ")"))
                .mapNotNull { it.optStringOrNull("conversation_id") }
            if (sharedIds.isNotEmpty()) {
                val existing = array(rest("/rest/v1/conversations?select=id&id=in.(" + sharedIds.joinToString(",") + ")&is_group=eq.false&order=updated_at.desc&limit=1"))
                    .firstOrNull()?.optStringOrNull("id")
                if (existing != null) return existing
            }
        }

        val created = array(rest("/rest/v1/conversations", "POST",
            JSONObject().put("is_group", false).put("created_by", userId).put("updated_at", java.time.Instant.now().toString()),
            "return=representation")).firstOrNull()?.optStringOrNull("id")
            ?: throw ApiException("تعذّر إنشاء المحادثة")

        rest("/rest/v1/conversation_members", "POST", JSONObject().put("conversation_id", created).put("user_id", userId))
        rest("/rest/v1/conversation_members", "POST", JSONObject().put("conversation_id", created).put("user_id", otherUserId))
        return created
    }

    suspend fun markConversationRead(conversationId: String) {
        val userId = session?.userId.orEmpty()
        if (userId.isBlank()) return
        rest("/rest/v1/rpc/mark_conversation_read", "POST", JSONObject().put("_conv_id", conversationId).put("_user_id", userId))
    }

    suspend fun leaveConversation(conversationId: String) {
        val userId = session?.userId.orEmpty()
        rest("/rest/v1/rpc/leave_conversation", "POST", JSONObject().put("_conv_id", conversationId).put("_user_id", userId))
    }

    suspend fun deleteConversation(conversationId: String) {
        val userId = session?.userId.orEmpty()
        rest("/rest/v1/rpc/delete_conversation", "POST", JSONObject().put("_conv_id", conversationId).put("_user_id", userId))
    }

    suspend fun setUserBlocked(otherUserId: String, blocked: Boolean) {
        val userId = session?.userId?.takeIf { it.isNotBlank() } ?: throw ApiException("انتهت جلسة الدخول")
        if (blocked) {
            rest("/rest/v1/blocked_users", "POST", JSONObject().put("blocker_id", userId).put("blocked_id", otherUserId))
        } else {
            rest("/rest/v1/blocked_users?blocker_id=eq." + encode(userId) + "&blocked_id=eq." + encode(otherUserId), "DELETE")
        }
    }

    suspend fun reportMessageThread(conversationId: String, reportedUserId: String, reason: String, note: String?) {
        val userId = session?.userId?.takeIf { it.isNotBlank() } ?: throw ApiException("انتهت جلسة الدخول")
        rest("/rest/v1/message_reports", "POST", JSONObject()
            .put("reporter_id", userId).put("reported_user_id", reportedUserId)
            .put("conversation_id", conversationId).put("reason", reason).put("note", note ?: JSONObject.NULL))
    }

    /** "get_unread_message_count" is absent from the live schema; sum the per-conversation counts instead (same RPC the web client uses). */
    suspend fun unreadMessageCount(): Int {
        val userId = session?.userId.orEmpty()
        if (userId.isBlank()) return 0
        return array(rest("/rest/v1/rpc/get_conversation_unread_counts", "POST", JSONObject().put("_user_id", userId)))
            .sumOf { it.optInt("unread_count") }
    }

    // ---------------------------------------------------------------------
    // Notifications
    // ---------------------------------------------------------------------

    suspend fun loadNotifications(): NotificationsState {
        val userId = session?.userId.orEmpty()
        if (userId.isBlank()) return NotificationsState()
        val rows = array(rest("/rest/v1/notifications?select=id,type,title,body,link,actor_name,actor_avatar,priority,read,created_at&recipient_id=eq." + encode(userId) + "&order=created_at.desc&limit=100"))
        val items = rows.map { row ->
            NotificationItem(
                id = row.optString("id"), type = row.optString("type"), title = row.optString("title"),
                body = row.optStringOrNull("body"), link = row.optStringOrNull("link"), actorName = row.optStringOrNull("actor_name"),
                actorAvatar = row.optStringOrNull("actor_avatar"), priority = row.optString("priority", "normal"),
                read = row.optBoolean("read"), createdAt = row.optString("created_at")
            )
        }
        return NotificationsState(items = items, unreadCount = items.count { !it.read })
    }

    suspend fun markNotificationRead(id: String) {
        rest("/rest/v1/notifications?id=eq." + encode(id), "PATCH", JSONObject().put("read", true))
    }

    suspend fun markAllNotificationsRead() {
        val userId = session?.userId.orEmpty()
        if (userId.isBlank()) return
        rest("/rest/v1/notifications?recipient_id=eq." + encode(userId) + "&read=eq.false", "PATCH", JSONObject().put("read", true))
    }

    /** Best-effort: a failed notification must never break the action that triggered it. */
    private suspend fun notifyUser(recipientId: String, type: String, title: String, body: String, link: String) {
        val userId = session?.userId.orEmpty()
        if (recipientId.isBlank() || recipientId == userId) return
        runCatching {
            rest("/rest/v1/notifications", "POST", JSONObject()
                .put("recipient_id", recipientId).put("actor_id", userId).put("type", type)
                .put("title", title).put("body", body).put("priority", "normal").put("link", link).put("read", false))
        }
    }

    // ---------------------------------------------------------------------
    // Search
    // ---------------------------------------------------------------------

    suspend fun search(query: String): SearchResults {
        val q = query.trim()
        if (q.length < 2) return SearchResults()
        return coroutineScope {
            val peopleTask = async { array(rest("/rest/v1/rpc/search_public_profiles", "POST", JSONObject().put("_q", q))) }
            val postsTask = async { array(rest("/rest/v1/posts?select=id,author_id,content,images,created_at,is_anonymous,post_type,accepted_answer_id&content=" + encode("ilike.%$q%") + "&order=created_at.desc&limit=20")) }
            val coursesTask = async { array(rest("/rest/v1/courses?select=id,name,description,major,year,semester,teacher_id&name=" + encode("ilike.%$q%") + "&limit=20")) }

            val people = peopleTask.await().map {
                PublicProfile(it.optString("id"), it.optString("full_name", "مستخدم"), it.optStringOrNull("avatar_url"), false)
            }
            val postRows = postsTask.await()
            val authorIds = postRows.mapNotNull { it.optStringOrNull("author_id") }.toSet()
            val authorProfiles = publicProfiles(authorIds)
            val posts = postRows.map { row ->
                val authorId = row.optStringOrNull("author_id")
                val anonymous = row.optBoolean("is_anonymous") || authorId == null
                val author = authorProfiles[authorId]
                FeedPost(
                    id = row.optString("id"), authorId = authorId,
                    authorName = if (anonymous) "طالب مجهول" else author?.fullName ?: "طالب",
                    avatarUrl = if (anonymous) null else author?.avatarUrl, anonymous = anonymous,
                    content = row.optString("content"), postType = row.optString("post_type", "general"),
                    createdAt = row.optString("created_at"), commentsCount = 0, images = row.strList("images"),
                    acceptedAnswerId = row.optStringOrNull("accepted_answer_id")
                )
            }
            val courses = coursesTask.await().map { row ->
                Course(row.optString("id"), row.optString("name"), row.optStringOrNull("description"), row.optString("major"),
                    row.optInt("year"), row.optInt("semester"), row.optStringOrNull("teacher_id"), null, emptyList())
            }
            SearchResults(people = people, posts = posts, courses = courses)
        }
    }

    // ---------------------------------------------------------------------
    // Leaderboard
    // ---------------------------------------------------------------------

    suspend fun loadLeaderboard(major: String?, year: Int?): List<LeaderboardEntry> {
        val path = "/rest/v1/rpc/get_leaderboard_profiles"
        val body = JSONObject()
        if (!major.isNullOrBlank()) body.put("_major", major)
        if (year != null) body.put("_year", year)
        val rows = array(rest(path, "POST", body))
        return rows.sortedByDescending { it.optInt("points") }.mapIndexed { index, row ->
            LeaderboardEntry(
                id = row.optString("id"), fullName = row.optString("full_name", "طالب"),
                avatarUrl = row.optStringOrNull("avatar_url"), major = row.optStringOrNull("major"), year = row.optInt("year").takeIf { row.has("year") },
                points = row.optInt("points"), verified = row.optBoolean("verified"),
                universityNumber = row.optString("university_number"), rank = index + 1
            )
        }
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    suspend fun loadRole(): AppRole {
        val userId = session?.userId.orEmpty()
        if (userId.isBlank()) return AppRole.UNKNOWN
        val rows = array(rest("/rest/v1/user_roles?select=role&user_id=eq." + encode(userId)))
        val roles = rows.mapNotNull { it.optStringOrNull("role") }
        return when {
            roles.contains("admin") -> AppRole.ADMIN
            roles.contains("sub_admin") -> AppRole.SUB_ADMIN
            roles.contains("teacher") -> AppRole.TEACHER
            else -> AppRole.STUDENT
        }
    }

    suspend fun loadAdminUsers(): List<AdminUserRow> {
        val rows = array(rest("/rest/v1/profiles?select=id,full_name,university_number,avatar_url,major,year,points,verified,banned,suspended_until&order=created_at.desc&limit=500"))
        val roleRows = array(rest("/rest/v1/user_roles?select=user_id,role&limit=1000"))
        val roleByUser = roleRows.associate { it.optString("user_id") to it.optString("role") }
        return rows.map { row ->
            val id = row.optString("id")
            AdminUserRow(
                id = id, fullName = row.optString("full_name", "طالب"), universityNumber = row.optString("university_number"),
                avatarUrl = row.optStringOrNull("avatar_url"), major = row.optStringOrNull("major"), year = row.optInt("year").takeIf { row.has("year") },
                role = roleByUser[id] ?: "student", points = row.optInt("points"), verified = row.optBoolean("verified"),
                banned = row.optBoolean("banned"), suspendedUntil = row.optStringOrNull("suspended_until")
            )
        }
    }

    suspend fun adminSetRole(userId: String, role: String) { rest("/rest/v1/rpc/admin_set_user_role", "POST", JSONObject().put("_user", userId).put("_role", role)) }
    suspend fun adminBan(userId: String, reason: String) { rest("/rest/v1/rpc/admin_ban", "POST", JSONObject().put("_user", userId).put("_reason", reason)) }
    suspend fun adminUnban(userId: String) { rest("/rest/v1/rpc/admin_unban", "POST", JSONObject().put("_user", userId)) }
    suspend fun adminSuspend(userId: String, days: Int, reason: String) { rest("/rest/v1/rpc/admin_suspend", "POST", JSONObject().put("_user", userId).put("_days", days).put("_reason", reason)) }
    // adminWarn removed: the web app has no "admin_warn" RPC either — warning_count is a read-only stat, not an action.
    suspend fun adminSetVerified(userId: String, verified: Boolean) { rest("/rest/v1/rpc/admin_set_verified", "POST", JSONObject().put("_user", userId).put("_verified", verified)) }
    suspend fun adminAdjustPoints(userId: String, delta: Int) { rest("/rest/v1/rpc/admin_adjust_points", "POST", JSONObject().put("_user", userId).put("_delta", delta)) }
    suspend fun adminDeleteUser(userId: String) { rest("/rest/v1/rpc/admin_delete_user", "POST", JSONObject().put("_user", userId)) }
    suspend fun adminSetTeacherRole(userId: String) { rest("/rest/v1/rpc/admin_set_teacher_role", "POST", JSONObject().put("_user", userId)) }

    suspend fun loadPostReports(): List<PostReport> {
        val rows = array(rest("/rest/v1/post_reports?select=id,post_id,reporter_id,reason,created_at&order=created_at.desc&limit=200"))
        val postIds = rows.mapNotNull { it.optStringOrNull("post_id") }.toSet()
        val reporterIds = rows.mapNotNull { it.optStringOrNull("reporter_id") }.toSet()
        val posts = if (postIds.isEmpty()) emptyMap() else array(rest("/rest/v1/posts?select=id,content&id=in.(" + postIds.joinToString(",") + ")")).associate { it.optString("id") to it.optString("content") }
        val reporters = publicProfiles(reporterIds)
        return rows.map { row ->
            val reporterId = row.optString("reporter_id")
            PostReport(row.optString("id"), row.optString("post_id"), posts[row.optString("post_id")], reporterId,
                reporters[reporterId]?.fullName, row.optString("reason"), row.optString("created_at"))
        }
    }

    suspend fun loadMessageReports(): List<MessageReport> {
        val rows = array(rest("/rest/v1/message_reports?select=id,conversation_id,reporter_id,reported_user_id,reason,note,created_at&order=created_at.desc&limit=200"))
        val ids = (rows.mapNotNull { it.optStringOrNull("reporter_id") } + rows.mapNotNull { it.optStringOrNull("reported_user_id") }).toSet()
        val profiles = publicProfiles(ids)
        return rows.map { row ->
            val reporterId = row.optString("reporter_id"); val reportedId = row.optString("reported_user_id")
            MessageReport(row.optString("id"), row.optString("conversation_id"), reporterId, profiles[reporterId]?.fullName,
                reportedId, profiles[reportedId]?.fullName, row.optString("reason"), row.optStringOrNull("note"), row.optString("created_at"))
        }
    }

    suspend fun dismissPostReport(id: String) { rest("/rest/v1/post_reports?id=eq." + encode(id), "DELETE") }
    suspend fun dismissMessageReport(id: String) { rest("/rest/v1/message_reports?id=eq." + encode(id), "DELETE") }
    suspend fun deletePostAsAdmin(postId: String) { rest("/rest/v1/posts?id=eq." + encode(postId), "DELETE") }

    suspend fun loadBannedWords(): List<BannedWord> =
        array(rest("/rest/v1/banned_words?select=id,word&order=word.asc")).map { BannedWord(it.optString("id"), it.optString("word")) }

    suspend fun addBannedWord(word: String) { rest("/rest/v1/banned_words", "POST", JSONObject().put("word", word.trim())) }
    suspend fun removeBannedWord(id: String) { rest("/rest/v1/banned_words?id=eq." + encode(id), "DELETE") }

    suspend fun loadRecentAdminActivity(): List<AdminActivityItem> =
        array(rest("/rest/v1/rpc/get_recent_admin_activity", "POST", JSONObject())).map { row ->
            AdminActivityItem(row.optString("id"), row.optString("activity_type"), row.optString("description"), row.optStringOrNull("user_name"), row.optString("created_at"))
        }

    /** Counts cap at 2000 rows: enough for an overview card, not a billing-grade total. */

    // ---------------------------------------------------------------------
    // Admin: courses (read-only, mirrors CoursesManagementTab.tsx on the web)
    // ---------------------------------------------------------------------
    suspend fun loadAdminCourses(): List<AdminCourseRow> {
        val rows = array(rest("/rest/v1/courses?select=id,name,major,year,semester,teacher_id,created_at&order=created_at.desc&limit=200"))
        val teacherIds = rows.mapNotNull { it.optStringOrNull("teacher_id") }.toSet()
        val teachers = publicProfiles(teacherIds)
        return rows.map { row ->
            val teacherId = row.optStringOrNull("teacher_id")
            AdminCourseRow(
                id = row.optString("id"), name = row.optString("name"), major = row.optStringOrNull("major"),
                year = row.optInt("year").takeIf { row.has("year") }, semester = row.optInt("semester").takeIf { row.has("semester") },
                teacherName = teachers[teacherId]?.fullName
            )
        }
    }

    // ---------------------------------------------------------------------
    // Admin: name-change requests (mirrors src/lib/nameChangeRequests.ts)
    // ---------------------------------------------------------------------
    suspend fun loadNameChangeRequests(): List<NameChangeRequestRow> {
        val rows = runCatching {
            array(rest("/rest/v1/name_change_requests?select=id,user_id,current_name,requested_name,reason,status,created_at&order=created_at.desc&limit=200"))
        }.getOrDefault(emptyList())
        return rows.map { row ->
            NameChangeRequestRow(
                id = row.optString("id"), userId = row.optString("user_id"),
                currentName = row.optString("current_name"), requestedName = row.optString("requested_name"),
                reason = row.optStringOrNull("reason"), status = row.optString("status", "pending"),
                createdAt = row.optString("created_at")
            )
        }
    }

    suspend fun approveNameChangeRequest(request: NameChangeRequestRow) {
        rest("/rest/v1/name_change_requests?id=eq." + encode(request.id), "PATCH",
            JSONObject().put("status", "approved").put("processed_at", java.time.Instant.now().toString()))
        rest("/rest/v1/profiles?id=eq." + encode(request.userId), "PATCH",
            JSONObject().put("full_name", request.requestedName))
    }

    suspend fun rejectNameChangeRequest(id: String) {
        rest("/rest/v1/name_change_requests?id=eq." + encode(id), "PATCH",
            JSONObject().put("status", "rejected").put("processed_at", java.time.Instant.now().toString()))
    }

    // ---------------------------------------------------------------------
    // Admin: sub-admin permissions
    // ---------------------------------------------------------------------
    suspend fun loadSubAdmins(): List<SubAdminRow> {
        val rows = array(rest("/rest/v1/subadmin_permissions?select=user_id,can_courses,can_reports,can_suspend,can_teachers,can_warn,can_words"))
        val ids = rows.mapNotNull { it.optStringOrNull("user_id") }.toSet()
        val profiles = publicProfiles(ids)
        return rows.map { row ->
            val id = row.optString("user_id")
            SubAdminRow(
                userId = id, fullName = profiles[id]?.fullName ?: "مستخدم", avatarUrl = profiles[id]?.avatarUrl,
                canCourses = row.optBoolean("can_courses"), canReports = row.optBoolean("can_reports"),
                canSuspend = row.optBoolean("can_suspend"), canTeachers = row.optBoolean("can_teachers"),
                canWarn = row.optBoolean("can_warn"), canWords = row.optBoolean("can_words")
            )
        }
    }

    suspend fun setSubAdminPermission(userId: String, field: String, value: Boolean) {
        rest("/rest/v1/subadmin_permissions?user_id=eq." + encode(userId), "PATCH", JSONObject().put(field, value))
    }

    suspend fun addSubAdmin(userId: String) {
        adminSetRole(userId, "sub_admin")
        rest("/rest/v1/subadmin_permissions", "POST", JSONObject().put("user_id", userId)
            .put("can_courses", false).put("can_reports", true).put("can_suspend", false)
            .put("can_teachers", false).put("can_warn", false).put("can_words", true))
    }

    suspend fun removeSubAdmin(userId: String) {
        rest("/rest/v1/subadmin_permissions?user_id=eq." + encode(userId), "DELETE")
        adminSetRole(userId, "student")
    }

    suspend fun loadAdminStats(): AdminStats = coroutineScope {
        val since = java.time.Instant.now().minusSeconds(14L * 86400).toString()
        val usersTask = async { array(rest("/rest/v1/profiles?select=id&limit=2000")) }
        val postsTask = async { array(rest("/rest/v1/posts?select=id&limit=2000")) }
        val coursesTask = async { array(rest("/rest/v1/courses?select=id&limit=2000")) }
        val reportsTask = async { array(rest("/rest/v1/post_reports?select=id")) }
        val dailyPostsTask = async { array(rest("/rest/v1/rpc/get_daily_posts", "POST", JSONObject().put("since", since))) }
        val dailyRegTask = async { array(rest("/rest/v1/rpc/get_daily_user_registrations", "POST", JSONObject().put("since", since))) }
        AdminStats(
            totalUsers = usersTask.await().size, totalPosts = postsTask.await().size,
            totalCourses = coursesTask.await().size, pendingReports = reportsTask.await().size,
            dailyPosts = dailyPostsTask.await().map { it.optString("day") to it.optInt("count") },
            dailyRegistrations = dailyRegTask.await().map { it.optString("day") to it.optInt("count") }
        )
    }

    private suspend fun publicProfiles(ids: Set<String>): Map<String, PublicProfile> {
        if (ids.isEmpty()) return emptyMap()
        val idArray = JSONArray()
        ids.forEach { idArray.put(it) }
        val rows = array(rest("/rest/v1/rpc/get_public_profiles", "POST", JSONObject().put("_ids", idArray)))
        val avatarPaths = rows.mapNotNull { it.optStringOrNull("avatar_url")?.takeIf { path -> !path.startsWith("http") } }.distinct()
        val signedAvatars = if (avatarPaths.isEmpty()) emptyMap() else resolveStorageUrls("avatars", avatarPaths)
        return rows.associate { row ->
            val id = row.optString("id")
            val rawAvatar = row.optStringOrNull("avatar_url")
            val avatar = if (rawAvatar.isNullOrBlank() || rawAvatar.startsWith("http")) rawAvatar else signedAvatars[rawAvatar] ?: rawAvatar
            id to PublicProfile(id, row.optString("full_name", "مستخدم"), avatar, row.optBoolean("verified"), row.optStringOrNull("major"), row.optInt("points"))
        }
    }

    private suspend fun resolveStorageUrls(bucket: String, paths: List<String>): Map<String, String> {
        val unique = paths.filter { it.isNotBlank() && !it.startsWith("http") }.distinct()
        if (unique.isEmpty()) return emptyMap()
        val response = array(rest("/storage/v1/object/sign/" + bucket, "POST",
            JSONObject().put("expiresIn", 3600).put("paths", JSONArray(unique))))
        return response.mapNotNull { row ->
            val path = row.optString("path")
            val signed = row.optString("signedURL").ifBlank { row.optString("signedUrl") }
            if (path.isBlank() || signed.isBlank()) null
            else path to if (signed.startsWith("http")) signed else baseUrl + "/storage/v1" + if (signed.startsWith("/")) signed else "/" + signed
        }.toMap()
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

    private fun JSONObject.strList(key: String): List<String> {
        val arr = optJSONArray(key) ?: return emptyList()
        return (0 until arr.length()).mapNotNull { idx -> arr.optString(idx).takeIf { it.isNotBlank() && it != "null" } }
    }

    private fun parseScalar(raw: String): String = raw.trim().trim('"')

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
