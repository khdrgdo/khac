package com.nexus.app.data

enum class AppScreen {
    LOGIN, HOME, FEED, COURSES, COURSE_DETAIL, PROFILE, CHANGE_PASSWORD, LEADERBOARD, SAVED, NOTIFICATIONS, MESSAGES, CHAT, ADMIN, POST_DETAIL, SEARCH, PUBLIC_PROFILE
}

enum class CourseTab(val label: String) {
    FILES("الملفات"),
    LINKS("المصادر"),
    DISCUSSIONS("النقاشات"),
    UPDATES("الإعلانات"),
    SCHEDULE("الجدول")
}

enum class ThemeMode(val label: String) {
    SYSTEM("تلقائي"),
    LIGHT("فاتح"),
    DARK("داكن");

    companion object {
        fun from(value: String?): ThemeMode = entries.firstOrNull { it.name == value } ?: SYSTEM
    }
}

data class UserSession(
    val accessToken: String,
    val refreshToken: String,
    val expiresAt: Long,
    val userId: String
)

data class StudentProfile(
    val id: String,
    val universityNumber: String,
    val fullName: String,
    val major: String?,
    val year: Int?,
    val avatarUrl: String?,
    val bio: String?,
    val mustChangePassword: Boolean,
    val points: Int,
    val banned: Boolean,
    val suspendedUntil: String?,
    val theme: String = "stars",
    val roles: List<String> = listOf("student"),
    val subAdminPermissions: Set<String> = emptySet()
)

data class PublicProfile(
    val id: String,
    val fullName: String,
    val avatarUrl: String?,
    val verified: Boolean
)

data class ScheduleEntry(
    val day: String,
    val start: String,
    val end: String,
    val room: String
)

data class Course(
    val id: String,
    val name: String,
    val description: String?,
    val major: String,
    val year: Int,
    val semester: Int,
    val teacherId: String?,
    val teacherName: String?,
    val schedule: List<ScheduleEntry>,
    val fileCount: Int = 0,
    val linkCount: Int = 0,
    val lastUpdated: String? = null
)

data class CourseMaterial(
    val id: String,
    val courseId: String,
    val title: String,
    val note: String?,
    val url: String,
    val linkType: String?,
    val createdAt: String,
    val important: Boolean,
    val courseName: String? = null
) {
    val isFile: Boolean get() = linkType == "file"
    val extension: String get() = url.substringAfterLast('.', "").substringBefore('?').lowercase()
}

data class FeedPost(
    val id: String,
    val authorId: String?,
    val authorName: String,
    val avatarUrl: String?,
    val anonymous: Boolean,
    val content: String,
    val postType: String,
    val createdAt: String,
    val commentsCount: Int,
    val images: List<String> = emptyList(),
    val reactions: List<FeedReaction> = emptyList(),
    val myReaction: String? = null,
    val saved: Boolean = false,
    val acceptedAnswerId: String? = null
)


data class FeedComment(val id: String, val postId: String, val authorId: String?, val authorName: String, val avatarUrl: String?, val content: String, val createdAt: String, val anonymous: Boolean, val parentId: String?)
data class PostDetail(val post: FeedPost, val comments: List<FeedComment>)

data class FeedReaction(val userId: String, val type: String)

data class CourseUpdate(
    val id: String,
    val courseId: String,
    val authorName: String,
    val content: String,
    val createdAt: String
)

data class CourseComment(
    val id: String,
    val authorId: String?,
    val authorName: String,
    val avatarUrl: String?,
    val content: String,
    val createdAt: String,
    val isTeacher: Boolean
)

data class CourseQuestion(
    val id: String,
    val authorId: String?,
    val authorName: String,
    val avatarUrl: String?,
    val verified: Boolean,
    val content: String,
    val createdAt: String,
    val replies: List<CourseComment>
)

data class CourseDetail(
    val course: Course,
    val files: List<CourseMaterial>,
    val links: List<CourseMaterial>,
    val questions: List<CourseQuestion>,
    val updates: List<CourseUpdate>
)




data class AdminUser(val id: String, val fullName: String, val universityNumber: String, val major: String?, val year: Int?, val points: Int, val banned: Boolean, val suspendedUntil: String?, val roles: List<String>)
data class AdminReport(val id: String, val postId: String, val content: String, val reporterName: String, val reason: String, val status: String, val createdAt: String)

data class PublicUser(val id: String, val fullName: String, val universityNumber: String, val avatarUrl: String?, val major: String?)
data class ConversationPreview(val id: String, val title: String, val isGroup: Boolean, val otherUserId: String?, val lastMessage: String, val updatedAt: String)
data class ChatMessage(val id: String, val conversationId: String, val senderId: String, val content: String, val createdAt: String)


data class PollOption(val id: String, val text: String)
data class PinnedCardConfig(
    val id: String, val enabled: Boolean, val type: String, val theme: String, val badgeText: String, val title: String,
    val description: String, val imageUrl: String?, val endDate: String?, val actionButtonText: String?, val actionButtonUrl: String?,
    val targetYear: Int?, val targetMajor: String?, val pollOptions: List<PollOption>, val votes: Map<String, String>,
    val participants: List<String>
)

data class PublicProfileDetail(val profile: StudentProfile, val posts: List<FeedPost>, val postsCount: Int, val commentsCount: Int, val acceptedAnswers: Int)

data class SearchBundle(val posts: List<FeedPost>, val courses: List<Course>, val users: List<PublicUser>)

data class NotificationItem(val id: String, val title: String, val body: String, val type: String, val link: String?, val read: Boolean, val createdAt: String,
    val actorName: String? = null, val priority: String = "normal", val localActivity: Boolean = false, val actorId: String? = null)

data class LeaderboardCourse(val id: String, val name: String, val major: String?, val year: Int?)
data class LeaderboardUser(
    val id: String,
    val fullName: String,
    val avatarUrl: String?,
    val points: Int,
    val major: String?,
    val year: Int?,
    val verified: Boolean,
    val score: Int,
    val contributions: Int
)

data class NexusUiState(
    val screen: AppScreen = AppScreen.LOGIN,
    val previousScreen: AppScreen = AppScreen.HOME,
    val loading: Boolean = true,
    val busy: Boolean = false,
    val detailLoading: Boolean = false,
    val profile: StudentProfile? = null,
    val courses: List<Course> = emptyList(),
    val recentMaterials: List<CourseMaterial> = emptyList(),
    val feedPosts: List<FeedPost> = emptyList(),
    val draftImagePaths: List<String> = emptyList(),
    val leaderboard: List<LeaderboardUser> = emptyList(),
    val leaderboardCourses: List<LeaderboardCourse> = emptyList(),
    val leaderboardLoading: Boolean = false,
    val notifications: List<NotificationItem> = emptyList(),
    val notificationsLoading: Boolean = false,
    val conversations: List<ConversationPreview> = emptyList(),
    val messages: List<ChatMessage> = emptyList(),
    val activeConversationId: String? = null,
    val messageSearchResults: List<PublicUser> = emptyList(),
    val messagesLoading: Boolean = false,
    val adminUsers: List<AdminUser> = emptyList(),
    val adminReports: List<AdminReport> = emptyList(),
    val adminLoading: Boolean = false,
    val pinnedCard: PinnedCardConfig? = null,
    val postDetail: PostDetail? = null,
    val postDetailLoading: Boolean = false,
    val searchResults: SearchBundle? = null,
    val searchLoading: Boolean = false,
    val publicProfile: PublicProfileDetail? = null,
    val publicProfileLoading: Boolean = false,
    val selectedCourse: Course? = null,
    val courseDetail: CourseDetail? = null,
    val selectedTab: CourseTab = CourseTab.FILES,
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val error: String? = null,
    val notice: String? = null,
    val pendingUrl: String? = null
)

fun normalizeLoginIdentifier(value: String): String {
    val cleaned = value.trim()
    if (cleaned.isEmpty()) throw IllegalArgumentException("أدخل الرقم الجامعي أو البريد الإلكتروني")
    if (cleaned.contains("@")) return cleaned
    if (cleaned.all { it.isDigit() }) return cleaned + "@college.edu"
    val username = cleaned.lowercase().replace(Regex("\\s+"), "").removePrefix("sub_")
    if (username.isNotBlank()) return username + "@subadmin.edu"
    throw IllegalArgumentException("أدخل الرقم الجامعي أو اسم المشرف المساعد أو البريد الإلكتروني")
}

fun majorLabel(code: String?): String = when (code?.lowercase()) {
    "it" -> "تقنية المعلومات"
    "is" -> "نظم المعلومات"
    "se" -> "هندسة البرمجيات"
    else -> "التخصص غير محدد"
}
