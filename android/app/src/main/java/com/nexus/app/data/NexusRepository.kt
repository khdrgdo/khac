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
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okio.source
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
        val currentUser = session?.userId
        return rows.filter { row ->
            val number = row.optString("university_number")
            val name = row.optString("full_name")
            row.optString("id") != currentUser && !number.startsWith("sub_") &&
                !listOf("أدمن", "ادمن", "admin", "مدير", "a guard").any { name.contains(it, true) }
        }.map { PublicUser(it.optString("id"), it.optString("full_name", "مستخدم"), it.optString("university_number"), avatarDisplayUrl(it.optStringOrNull("avatar_url")), it.optStringOrNull("major")) }
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
            val profile = if (otherId == null) null else publicProfiles(setOf(otherId))[otherId]
            val last = array(rest("/rest/v1/messages?select=content,created_at&conversation_id=eq.${encode(id)}&order=created_at.desc&limit=1")).firstOrNull()
            ConversationPreview(id, if (c.optBoolean("is_group")) c.optString("name", "مجموعة") else profile?.fullName ?: "محادثة",
                c.optBoolean("is_group"), otherId, last?.optString("content").orEmpty(), c.optString("updated_at"), profile?.avatarUrl)
        }
    }

    suspend fun loadMessages(conversationId: String): List<ChatMessage> = array(rest("/rest/v1/messages?select=id,conversation_id,sender_id,content,created_at&conversation_id=eq.${encode(conversationId)}&order=created_at.asc&limit=300"))
        .map { ChatMessage(it.optString("id"), it.optString("conversation_id"), it.optString("sender_id"), it.optString("content"), it.optString("created_at")) }

    suspend fun createDirectConversation(otherUserId: String): String {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        if (otherUserId == userId) throw ApiException("لا يمكنك مراسلة نفسك")
        val rpcId = runCatching {
            val raw = rest("/rest/v1/rpc/create_dm", "POST", JSONObject().put("_other", otherUserId)).trim()
            runCatching { JSONObject(raw).optString("id") }.getOrDefault(raw.trim('"'))
        }.getOrNull()?.takeIf(String::isNotBlank)
        if (rpcId != null) return rpcId
        val mine = array(rest("/rest/v1/conversation_members?select=conversation_id&user_id=eq.${encode(userId)}"))
            .map { it.optString("conversation_id") }
        if (mine.isNotEmpty()) {
            val theirs = array(rest("/rest/v1/conversation_members?select=conversation_id&user_id=eq.${encode(otherUserId)}&conversation_id=in.(${mine.joinToString(",") { encode(it) }})"))
                .map { it.optString("conversation_id") }
            if (theirs.isNotEmpty()) {
                val match = array(rest("/rest/v1/conversations?select=id&id=in.(${theirs.joinToString(",") { encode(it) }})&is_group=eq.false&order=updated_at.desc&limit=1")).firstOrNull()?.optString("id")
                if (!match.isNullOrBlank()) return match
            }
        }
        val created = JSONObject(rest("/rest/v1/conversations?select=id", "POST", JSONObject().put("is_group", false).put("created_by", userId).put("updated_at", java.time.Instant.now().toString())))
        val conversationId = created.optString("id").ifBlank { throw ApiException("تعذّر إنشاء المحادثة") }
        rest("/rest/v1/conversation_members", "POST", JSONObject().put("conversation_id", conversationId).put("user_id", userId))
        rest("/rest/v1/conversation_members", "POST", JSONObject().put("conversation_id", conversationId).put("user_id", otherUserId))
        return conversationId
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

    suspend fun reportMessageUser(conversationId: String, reportedUserId: String, reason: String, note: String?, messageId: String? = null) {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        rest("/rest/v1/message_reports", "POST", JSONObject().put("reporter_id", userId).put("reported_user_id", reportedUserId)
            .put("conversation_id", conversationId).put("reason", reason).put("note", note?.takeIf(String::isNotBlank)?.let { it } ?: JSONObject.NULL)
            .put("message_id", messageId?.let { it } ?: JSONObject.NULL))
    }






    suspend fun loadPublicProfile(profileId: String): PublicProfileDetail {
        val currentId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        val row = array(rest("/rest/v1/rpc/get_public_profiles", "POST", JSONObject().put("_ids", JSONArray().put(profileId)))).firstOrNull()
            ?: throw ApiException("الملف الشخصي غير متاح")
        val roles = array(rest("/rest/v1/user_roles?select=role&user_id=eq.${encode(profileId)}")).map { it.optString("role") }
        val universityNumber = row.optString("university_number")
        val isSubAdmin = "sub_admin" in roles || universityNumber.startsWith("sub_") || universityNumber.startsWith("SUBADMIN_")
        val currentRoles = array(rest("/rest/v1/user_roles?select=role&user_id=eq.${encode(currentId)}")).map { it.optString("role") }
        if (isSubAdmin && profileId != currentId && "admin" !in currentRoles) throw ApiException("هذا الملف غير متاح للطلاب")
        val avatarPath = row.optStringOrNull("avatar_url")
        val avatar = avatarDisplayUrl(avatarPath)
        val theme = if (profileId == currentId) row.optString("theme", "stars") else runCatching {
            array(rest("/rest/v1/profiles?select=theme&id=eq.${encode(profileId)}&limit=1")).firstOrNull()?.optString("theme", "stars") ?: "stars"
        }.getOrDefault("stars")
        val profile = StudentProfile(profileId, universityNumber, row.optString("full_name", "طالب"), row.optStringOrNull("major"),
            if (row.isNull("year")) null else row.optInt("year"), avatar, row.optStringOrNull("bio"), false, row.optInt("points"),
            false, null, theme, roles, emptySet())
        val postRows = array(rest("/rest/v1/posts?select=id,author_id,content,images,created_at,is_anonymous,post_type,accepted_answer_id&author_id=eq.${encode(profileId)}&order=created_at.desc&limit=50"))
        val postIds = postRows.map { it.optString("id") }.filter(String::isNotBlank)
        val counts = if (postIds.isEmpty()) emptyMap() else array(rest("/rest/v1/comments?select=post_id&post_id=in.(${postIds.joinToString(",") { encode(it) }})")).groupingBy { it.optString("post_id") }.eachCount()
        val posts = postRows.map { p ->
            val paths = p.optJSONArray("images")?.let { a -> (0 until a.length()).mapNotNull { a.optString(it).takeIf(String::isNotBlank) } }.orEmpty()
            val images = paths.mapNotNull { path -> runCatching { signedStorageUrl("post-images", path) }.getOrNull() }
            FeedPost(p.optString("id"), profileId, profile.fullName, profile.avatarUrl, p.optBoolean("is_anonymous"), p.optString("content"),
                p.optString("post_type", "general"), p.optString("created_at"), counts[p.optString("id")] ?: 0, images, emptyList(), null, false, p.optStringOrNull("accepted_answer_id"))
        }
        val commentsCount = array(rest("/rest/v1/comments?select=id&author_id=eq.${encode(profileId)}&limit=1000")).size
        val acceptedAnswers = if (postIds.isEmpty()) 0 else array(rest("/rest/v1/comments?select=id&author_id=eq.${encode(profileId)}&limit=1000")).let { comments ->
            val commentIds = comments.map { it.optString("id") }.filter(String::isNotBlank)
            if (commentIds.isEmpty()) 0 else array(rest("/rest/v1/posts?select=id&accepted_answer_id=in.(${commentIds.joinToString(",") { encode(it) }})")).size
        }
        return PublicProfileDetail(profile, posts, postRows.size, commentsCount, acceptedAnswers)
    }

    suspend fun searchGlobal(query: String): SearchBundle {
        val q = query.trim()
        if (q.length < 2) return SearchBundle(emptyList(), emptyList(), emptyList())
        val filter = encode(q)
        val postRows = array(rest("/rest/v1/posts?select=id,author_id,content,images,created_at,is_anonymous,post_type,accepted_answer_id&content=ilike.*$filter*&order=created_at.desc&limit=30"))
        val ids = postRows.mapNotNull { it.optStringOrNull("author_id") }.toSet()
        val profiles = publicProfiles(ids)
        val posts = postRows.map { row ->
            val authorId = row.optStringOrNull("author_id"); val anon = row.optBoolean("is_anonymous") || authorId == null
            val paths = row.optJSONArray("images")?.let { a -> (0 until a.length()).mapNotNull { a.optString(it).takeIf(String::isNotBlank) } }.orEmpty()
            val images = paths.mapNotNull { path -> runCatching { signedStorageUrl("post-images", path) }.getOrNull() }
            FeedPost(row.optString("id"), authorId, if (anon) "طالب مجهول" else profiles[authorId]?.fullName ?: "طالب",
                if (anon) null else profiles[authorId]?.avatarUrl, anon, row.optString("content"), row.optString("post_type", "general"),
                row.optString("created_at"), 0, images, emptyList(), null, false, row.optStringOrNull("accepted_answer_id"))
        }
        val courseRows = array(rest("/rest/v1/courses?select=id,name,description,major,year,semester,teacher_id&or=(name.ilike.*$filter*,description.ilike.*$filter*,major.ilike.*$filter*)&limit=30"))
        val courses = courseRows.map { row -> Course(row.optString("id"), row.optString("name"), row.optStringOrNull("description"), row.optString("major"), row.optInt("year"), row.optInt("semester"), row.optStringOrNull("teacher_id"), null, emptyList()) }
        val users = searchPublicUsers(q)
        return SearchBundle(posts, courses, users)
    }

    suspend fun loadPostDetail(postId: String): PostDetail {
        val row = array(rest("/rest/v1/posts?select=id,author_id,content,images,created_at,is_anonymous,post_type,accepted_answer_id&id=eq.${encode(postId)}&limit=1")).firstOrNull()
            ?: throw ApiException("المنشور غير موجود")
        val comments = array(rest("/rest/v1/comments?select=id,post_id,author_id,content,created_at,is_anonymous,parent_id&post_id=eq.${encode(postId)}&order=created_at.asc"))
        val ids = buildSet { row.optStringOrNull("author_id")?.let(::add); comments.forEach { it.optStringOrNull("author_id")?.let(::add) } }
        val profiles = publicProfiles(ids)
        val authorId = row.optStringOrNull("author_id")
        val anonymous = row.optBoolean("is_anonymous") || authorId == null
        val imagePaths = row.optJSONArray("images")?.let { a -> (0 until a.length()).mapNotNull { a.optString(it).takeIf(String::isNotBlank) } }.orEmpty()
        val images = imagePaths.mapNotNull { path -> runCatching { signedStorageUrl("post-images", path) }.getOrNull() }
        val post = FeedPost(postId, authorId, if (anonymous) "طالب مجهول" else profiles[authorId]?.fullName ?: "طالب",
            if (anonymous) null else profiles[authorId]?.avatarUrl, anonymous, row.optString("content"), row.optString("post_type", "general"),
            row.optString("created_at"), comments.size, images, emptyList(), null, false, row.optStringOrNull("accepted_answer_id"))
        val mapped = comments.map { c -> val id = c.optStringOrNull("author_id"); val anon = c.optBoolean("is_anonymous") || id == null
            FeedComment(c.optString("id"), postId, id, if (anon) "طالب مجهول" else profiles[id]?.fullName ?: "طالب",
                if (anon) null else profiles[id]?.avatarUrl, c.optString("content"), c.optString("created_at"), anon, c.optStringOrNull("parent_id")) }
        return PostDetail(post, mapped)
    }

    suspend fun createPostComment(postId: String, content: String, anonymous: Boolean, parentId: String?) {
        val body = JSONObject().put("_post_id", postId).put("_content", content.trim()).put("_anonymous", anonymous)
        if (!parentId.isNullOrBlank()) body.put("_parent_id", parentId)
        rest("/rest/v1/rpc/create_comment_as", "POST", body)
    }

    suspend fun acceptPostAnswer(postId: String, commentId: String?) {
        rest("/rest/v1/posts?id=eq.${encode(postId)}", "PATCH", JSONObject().put("accepted_answer_id", commentId?.let { it } ?: JSONObject.NULL))
    }

    suspend fun deletePostComment(commentId: String) {
        rest("/rest/v1/comments?id=eq.${encode(commentId)}", "DELETE")
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
        val rows = array(rest("/rest/v1/profiles?select=id,full_name,university_number,major,year,points,banned,suspended_until,avatar_url&order=points.desc&limit=500"))
        if (rows.isEmpty()) return emptyList()
        val ids = rows.map { it.optString("id") }
        val roleRows = array(rest("/rest/v1/user_roles?select=user_id,role&user_id=in.(${ids.joinToString(",") { encode(it) }})"))
            .groupBy { it.optString("user_id") }
        return rows.map { row -> val id = row.optString("id"); AdminUser(id, row.optString("full_name"), row.optString("university_number"),
            row.optStringOrNull("major"), if (row.isNull("year")) null else row.optInt("year"), row.optInt("points"), row.optBoolean("banned"),
            row.optStringOrNull("suspended_until"), roleRows[id].orEmpty().map { it.optString("role") }, avatarDisplayUrl(row.optStringOrNull("avatar_url"))) }
    }

    suspend fun loadAdminReports(): List<AdminReport> {
        val reports = array(rest("/rest/v1/post_reports?select=id,post_id,reporter_id,reason,status,created_at&order=created_at.desc&limit=100"))
        val postIds = reports.map { it.optString("post_id") }.filter(String::isNotBlank).distinct()
        val reporterIds = reports.map { it.optString("reporter_id") }.filter(String::isNotBlank).toSet()
        val posts = if (postIds.isEmpty()) emptyMap() else array(rest("/rest/v1/posts?select=id,content&id=in.(${postIds.joinToString(",") { encode(it) }})")).associateBy { it.optString("id") }
        val profiles = if (reporterIds.isEmpty()) emptyMap() else publicProfiles(reporterIds)
        val postReports = reports.map { row -> val postId = row.optString("post_id"); val reporterId = row.optString("reporter_id")
            AdminReport(row.optString("id"), postId, posts[postId]?.optString("content").orEmpty(), profiles[reporterId]?.fullName ?: "مستخدم",
                row.optString("reason"), row.optString("status", "pending"), row.optString("created_at"), "post") }
        val messageRows = array(rest("/rest/v1/message_reports?select=id,reporter_id,reported_user_id,conversation_id,message_id,reason,note,created_at&order=created_at.desc&limit=100"))
        val messageReporterIds = messageRows.map { it.optString("reporter_id") }.filter(String::isNotBlank).toSet()
        val messageProfiles = if (messageReporterIds.isEmpty()) emptyMap() else publicProfiles(messageReporterIds)
        val messageReports = messageRows.map { row -> AdminReport(row.optString("id"), row.optString("conversation_id"), row.optString("note").ifBlank { "بلاغ عن رسالة أو مستخدم" },
            messageProfiles[row.optString("reporter_id")]?.fullName ?: "مستخدم", row.optString("reason"), "pending", row.optString("created_at"), "message", row.optStringOrNull("reported_user_id"), row.optStringOrNull("message_id")) }
        return (postReports + messageReports).sortedByDescending { it.createdAt }
    }


    suspend fun uploadProfileAvatar(uri: Uri) {
        val current = session ?: throw ApiException("جلسة غير صالحة")
        val mime = appContext.contentResolver.getType(uri) ?: "image/jpeg"
        if (!mime.startsWith("image/")) throw ApiException("اختر صورة صالحة")
        val bytes = appContext.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: throw ApiException("تعذرت قراءة الصورة")
        if (bytes.size > 5 * 1024 * 1024) throw ApiException("حجم الصورة يتجاوز 5MB")
        val ext = when (mime.lowercase()) { "image/png" -> "png"; "image/webp" -> "webp"; "image/jpeg" -> "jpg"; else -> "jpg" }
        val path = "${current.userId}/${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(6)}.$ext"
        val request = Request.Builder().url(baseUrl + "/storage/v1/object/avatars/" + Uri.encode(path, "/"))
            .header("apikey", publishableKey).header("Authorization", "Bearer " + current.accessToken)
            .header("Content-Type", mime).header("x-upsert", "false").post(bytes.toRequestBody(mime.toMediaType())).build()
        execute(request)
        rest("/rest/v1/profiles?id=eq.${encode(current.userId)}", "PATCH", JSONObject().put("avatar_url", path))
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
        val items = mutableListOf<NotificationItem>()
        val dbRows = array(rest("/rest/v1/notifications?select=id,title,body,type,link,read,created_at,actor_name,priority&recipient_id=eq.${encode(userId)}&order=created_at.desc&limit=100"))
        dbRows.forEach { n -> items += NotificationItem(n.optString("id"), n.optString("title"), n.optString("body"), n.optString("type"), n.optStringOrNull("link"), n.optBoolean("read"), n.optString("created_at"), n.optStringOrNull("actor_name"), n.optString("priority", "normal"), false, n.optStringOrNull("actor_id")) }
        val ownPosts = array(rest("/rest/v1/posts?select=id,content&author_id=eq.${encode(userId)}&limit=500"))
        val postIds = ownPosts.map { it.optString("id") }.filter(String::isNotBlank)
        val postTitles = ownPosts.associate { it.optString("id") to it.optString("content").take(30) }
        val actorIds = mutableSetOf<String>()
        val synthetic = mutableListOf<NotificationItem>()
        if (postIds.isNotEmpty()) {
            val inFilter = postIds.joinToString(",") { encode(it) }
            val comments = array(rest("/rest/v1/comments?select=id,post_id,author_id,content,created_at&post_id=in.($inFilter)&author_id=neq.$userId&order=created_at.desc&limit=50"))
            comments.forEach { c -> c.optStringOrNull("author_id")?.let(actorIds::add); synthetic += NotificationItem("comment_${c.optString("id")}", "تعليق جديد على منشورك", c.optString("content"), "post_comment", "/posts/${c.optString("post_id")}", false, c.optString("created_at"), null, "normal", true, c.optStringOrNull("author_id")) }
            val reactions = array(rest("/rest/v1/post_reactions?select=post_id,user_id,reaction,created_at&post_id=in.($inFilter)&user_id=neq.$userId&order=created_at.desc&limit=50"))
            reactions.forEach { r ->
                val actor = r.optString("user_id"); actorIds += actor
                val emoji = when(r.optString("reaction")) { "like" -> "👍 إعجاب"; "love" -> "❤️ أحببته"; "haha" -> "😂 مضحك"; "wow" -> "😮 مدهش"; "sad" -> "😢 محزن"; else -> "تفاعل" }
                synthetic += NotificationItem("react_${r.optString("post_id")}_${actor}_${r.optString("reaction")}", "تفاعل جديد على منشورك", "$emoji • ${postTitles[r.optString("post_id")].orEmpty()}", "post_like", "/posts/${r.optString("post_id")}", false, r.optString("created_at"), null, "normal", true, actor)
            }
        }
        val convIds = array(rest("/rest/v1/conversation_members?select=conversation_id&user_id=eq.${encode(userId)}")).map { it.optString("conversation_id") }
        if (convIds.isNotEmpty()) {
            val msgs = array(rest("/rest/v1/messages?select=id,conversation_id,sender_id,content,created_at&conversation_id=in.(${convIds.joinToString(",") { encode(it) }})&sender_id=neq.$userId&order=created_at.desc&limit=20"))
            msgs.forEach { m -> actorIds += m.optString("sender_id"); synthetic += NotificationItem("msg_${m.optString("id")}", "رسالة خاصة", m.optString("content"), "comment_reply", "/messages/${m.optString("conversation_id")}", false, m.optString("created_at"), null, "normal", true, m.optString("sender_id")) }
        }
        val warnings = array(rest("/rest/v1/user_warnings?select=id,reason,created_at&user_id=eq.${encode(userId)}&order=created_at.desc&limit=10"))
        warnings.forEach { w -> synthetic += NotificationItem("warn_${w.optString("id")}", "تنبيه إداري ⚠️", "سبب التنبيه: ${w.optString("reason")}", "announcement", "/feed", false, w.optString("created_at"), null, "important", true, null) }
        val actorProfiles = if (actorIds.isEmpty()) emptyMap() else publicProfiles(actorIds)
        val hydrated = synthetic.map { n -> n.copy(actorName = n.actorId?.let { actorProfiles[it]?.fullName }) }
        val unique = (items + hydrated).distinctBy { it.id }
        val prefs = appContext.getSharedPreferences("nexus_notifications", android.content.Context.MODE_PRIVATE)
        val localRead = prefs.getStringSet("read_$userId", emptySet()).orEmpty()
        val localHidden = prefs.getStringSet("hidden_$userId", emptySet()).orEmpty()
        return unique.filter { !it.localActivity || it.id !in localHidden }
            .map { if (it.localActivity && it.id in localRead) it.copy(read = true) else it }
            .sortedByDescending { it.createdAt }
    }

    private fun updateLocalNotificationSet(userId: String, kind: String, id: String) {
        val prefs = appContext.getSharedPreferences("nexus_notifications", android.content.Context.MODE_PRIVATE)
        val values = prefs.getStringSet("${kind}_$userId", emptySet()).orEmpty().toMutableSet()
        values.add(id)
        prefs.edit().putStringSet("${kind}_$userId", values.toList().takeLast(500).toSet()).apply()
    }

    suspend fun markNotificationRead(id: String) {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        if (id.startsWith("comment_") || id.startsWith("react_") || id.startsWith("msg_") || id.startsWith("warn_")) { updateLocalNotificationSet(userId, "read", id); return }
        rest("/rest/v1/notifications?id=eq.${encode(id)}&recipient_id=eq.${encode(userId)}", "PATCH", JSONObject().put("read", true))
    }


    suspend fun markAllNotificationsRead() {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        val local = loadNotifications().filter { it.localActivity }.map { it.id }
        local.forEach { updateLocalNotificationSet(userId, "read", it) }
        rest("/rest/v1/notifications?recipient_id=eq.${encode(userId)}&read=eq.false", "PATCH", JSONObject().put("read", true))
    }

    suspend fun clearAllNotifications() {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        loadNotifications().filter { it.localActivity }.forEach { updateLocalNotificationSet(userId, "hidden", it.id) }
        rest("/rest/v1/notifications?recipient_id=eq.${encode(userId)}", "DELETE")
    }

    suspend fun deleteNotification(id: String) {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        if (id.startsWith("comment_") || id.startsWith("react_") || id.startsWith("msg_") || id.startsWith("warn_")) { updateLocalNotificationSet(userId, "hidden", id); return }
        rest("/rest/v1/notifications?id=eq.${encode(id)}&recipient_id=eq.${encode(userId)}", "DELETE")
    }

    suspend fun loadLeaderboardCourses(): List<LeaderboardCourse> = array(rest("/rest/v1/courses?select=id,name,major,year&order=name.asc&limit=300"))
        .map { LeaderboardCourse(it.optString("id"), it.optString("name"), it.optStringOrNull("major"), if (it.isNull("year")) null else it.optInt("year")) }

    suspend fun loadLeaderboard(timeframe: String = "all", major: String? = null, year: Int? = null, courseId: String? = null): List<LeaderboardUser> {
        val course = courseId?.let { id -> loadLeaderboardCourses().firstOrNull { it.id == id } }
        val effectiveMajor = course?.major ?: major
        val effectiveYear = course?.year ?: year
        val args = JSONObject()
        if (!effectiveMajor.isNullOrBlank()) args.put("_major", effectiveMajor)
        if (effectiveYear != null) args.put("_year", effectiveYear)
        val profiles = array(rest("/rest/v1/rpc/get_leaderboard_profiles", "POST", args))
        if (profiles.isEmpty()) return emptyList()
        val avatarProfiles = publicProfiles(profiles.map { it.optString("id") }.filter(String::isNotBlank).toSet())
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
            LeaderboardUser(id, fullName, avatarProfiles[id]?.avatarUrl, points,
                row.optStringOrNull("major"), if (row.isNull("year")) null else row.optInt("year"),
                row.optBoolean("verified"), score, contribution[id] ?: 0)
        }.sortedByDescending { it.score }
    }


    suspend fun uploadCourseFile(courseId: String, uri: Uri) {
        val current = session ?: throw ApiException("جلسة غير صالحة")
        val mime = appContext.contentResolver.getType(uri) ?: "application/octet-stream"
        val name = runCatching {
            appContext.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
        }.getOrNull()?.takeIf(String::isNotBlank) ?: uri.lastPathSegment?.substringAfterLast('/') ?: "material.bin"
        val isVideo = mime.startsWith("video/") || name.substringAfterLast('.', "").lowercase() in setOf("mp4", "mov", "webm", "mkv", "avi")
        val size = runCatching {
            appContext.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.SIZE), null, null, null)?.use { c -> if (c.moveToFirst()) c.getLong(0) else -1L } ?: -1L
        }.getOrDefault(-1L)
        val max = if (isVideo) 100L * 1024 * 1024 else 25L * 1024 * 1024
        if (size > max) throw ApiException(if (isVideo) "حجم الفيديو يتجاوز 100MB" else "حجم الملف يتجاوز 25MB")
        val safeName = name.replace(Regex("[^A-Za-z0-9._-]"), "_")
        val path = "$courseId/${System.currentTimeMillis()}-$safeName"
        val body = object : RequestBody() {
            override fun contentType() = mime.toMediaType()
            override fun contentLength() = size
            override fun writeTo(sink: okio.BufferedSink) {
                val stream = appContext.contentResolver.openInputStream(uri) ?: throw java.io.IOException("تعذرت قراءة الملف")
                stream.source().use { source ->
                    var total = 0L
                    val buffer = okio.Buffer()
                    while (true) {
                        val read = source.read(buffer, 8192)
                        if (read == -1L) break
                        total += read
                        if (total > max) throw java.io.IOException(if (isVideo) "حجم الفيديو يتجاوز 100MB" else "حجم الملف يتجاوز 25MB")
                        sink.write(buffer, read)
                    }
                }
            }
        }
        val request = Request.Builder().url(baseUrl + "/storage/v1/object/course-files/" + Uri.encode(path, "/"))
            .header("apikey", publishableKey).header("Authorization", "Bearer " + current.accessToken)
            .header("Content-Type", mime).header("x-upsert", "false").post(body).build()
        execute(request)
        rest("/rest/v1/course_links", "POST", JSONObject().put("course_id", courseId).put("title", name).put("url", path).put("link_type", "file").put("created_by", current.userId))
    }

    suspend fun addCourseLink(courseId: String, title: String, url: String) {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        require(title.isNotBlank() && url.startsWith("https://")) { "أدخل عنواناً ورابطاً آمناً يبدأ بـ https://" }
        rest("/rest/v1/course_links", "POST", JSONObject().put("course_id", courseId).put("title", title.trim()).put("url", url.trim()).put("created_by", userId))
    }

    suspend fun deleteCourseMaterial(material: CourseMaterial) {
        if (material.isFile) rest("/storage/v1/object/course-files/${Uri.encode(material.url, "/")}", "DELETE")
        rest("/rest/v1/course_links?id=eq.${encode(material.id)}", "DELETE")
    }

    suspend fun toggleCourseMaterialImportant(material: CourseMaterial) {
        rest("/rest/v1/course_links?id=eq.${encode(material.id)}", "PATCH", JSONObject().put("is_important", !material.important))
    }

    suspend fun addCourseUpdate(courseId: String, content: String) {
        val userId = session?.userId ?: throw ApiException("جلسة غير صالحة")
        require(content.isNotBlank()) { "اكتب نص الإعلان أولاً" }
        rest("/rest/v1/course_updates", "POST", JSONObject().put("course_id", courseId).put("author_id", userId).put("content", content.trim()))
    }

    suspend fun editCourseUpdate(id: String, content: String) {
        require(content.isNotBlank()) { "نص الإعلان لا يمكن أن يكون فارغاً" }
        rest("/rest/v1/course_updates?id=eq.${encode(id)}", "PATCH", JSONObject().put("content", content.trim()))
    }

    suspend fun deleteCourseUpdate(id: String) { rest("/rest/v1/course_updates?id=eq.${encode(id)}", "DELETE") }

    suspend fun updateCourseSchedule(courseId: String, entries: List<ScheduleEntry>) {
        val json = JSONArray()
        entries.forEach { json.put(JSONObject().put("day", it.day).put("start", it.start).put("end", it.end).put("room", it.room)) }
        rest("/rest/v1/courses?id=eq.${encode(courseId)}", "PATCH", JSONObject().put("schedule", json))
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
            avatarDisplayUrl(row.optStringOrNull("avatar_url")), row.optStringOrNull("bio"), row.optBoolean("must_change_password"),
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

    private suspend fun avatarDisplayUrl(value: String?): String? {
        val raw = value?.trim()?.takeIf(String::isNotBlank) ?: return null
        val publicMarker = "/storage/v1/object/public/avatars/"
        val signedMarker = "/storage/v1/object/sign/avatars/"
        val path = when {
            publicMarker in raw -> raw.substringAfter(publicMarker).substringBefore('?')
            signedMarker in raw -> raw.substringAfter(signedMarker).substringBefore('?')
            raw.startsWith("http://") || raw.startsWith("https://") -> return raw
            else -> raw.trimStart('/')
        }
        return runCatching { signedStorageUrl("avatars", path) }.getOrNull()
    }

    private suspend fun publicProfiles(ids: Set<String>): Map<String, PublicProfile> {
        if (ids.isEmpty()) return emptyMap()
        val idArray = JSONArray()
        ids.forEach { idArray.put(it) }
        val rows = array(rest("/rest/v1/rpc/get_public_profiles", "POST", JSONObject().put("_ids", idArray)))
        return rows.mapNotNull { row ->
            val id = row.optString("id").takeIf(String::isNotBlank) ?: return@mapNotNull null
            id to PublicProfile(id, row.optString("full_name", "مستخدم"), avatarDisplayUrl(row.optStringOrNull("avatar_url")), row.optBoolean("verified"))
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
