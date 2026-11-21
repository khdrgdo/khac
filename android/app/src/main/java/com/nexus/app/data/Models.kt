package com.nexus.app.data

enum class AppScreen {
    LOGIN, HOME, FEED, COURSES, COURSE_DETAIL, PROFILE, CHANGE_PASSWORD,
    MESSAGES, CONVERSATION, NOTIFICATIONS, SEARCH, LEADERBOARD, ADMIN
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
    val cardThemeId: String? = null,
    val hideUniversityNumber: Boolean = false,
    val hasUsedDirectNameChange: Boolean = false,
    val verified: Boolean = false,
    val warningCount: Int = 0
)

data class PublicProfile(
    val id: String,
    val fullName: String,
    val avatarUrl: String?,
    val verified: Boolean,
    val major: String? = null,
    val points: Int = 0
)

data class ProfileStats(
    val posts: Int = 0,
    val comments: Int = 0,
    val saved: Int = 0,
    val acceptedAnswers: Int = 0,
    val activityDates: List<String> = emptyList()
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

data class FeedReaction(
    val userId: String,
    val reaction: String
)

data class FeedComment(
    val id: String,
    val postId: String,
    val authorId: String?,
    val authorName: String,
    val avatarUrl: String?,
    val anonymous: Boolean,
    val content: String,
    val createdAt: String,
    val parentId: String? = null
)

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
    val acceptedAnswerId: String? = null,
    val authorMajor: String? = null,
    val authorPoints: Int = 0,
    val authorVerified: Boolean = false,
    val reactions: List<FeedReaction> = emptyList(),
    val myReaction: String? = null,
    val saved: Boolean = false
)

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
    val feedFilter: String = "all",
    val feedTag: String? = null,
    val profileStats: ProfileStats? = null,
    val selectedCourse: Course? = null,
    val courseDetail: CourseDetail? = null,
    val selectedTab: CourseTab = CourseTab.FILES,
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val error: String? = null,
    val notice: String? = null,
    val pendingUrl: String? = null,
    val role: AppRole = AppRole.UNKNOWN,
    val messaging: MessagingState = MessagingState(),
    val notifications: NotificationsState = NotificationsState(),
    val search: SearchState = SearchState(),
    val leaderboard: LeaderboardState = LeaderboardState(),
    val admin: AdminState = AdminState(),
    val feedComments: Map<String, List<FeedComment>> = emptyMap(),
    val feedCommentsLoading: Set<String> = emptySet()
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


object ProfileThemeRules {
    fun minimumPoints(themeId: String): Int? = when (themeId) {
        "stars" -> 0
        "clouds" -> 100
        "moon" -> 300
        "sun" -> 700
        "galaxy" -> 1500
        else -> null
    }
    fun defaultForPoints(points: Int): String = when {
        points >= 1500 -> "galaxy"
        points >= 700 -> "sun"
        points >= 300 -> "moon"
        points >= 100 -> "clouds"
        else -> "stars"
    }
    fun isUnlocked(points: Int, themeId: String): Boolean =
        minimumPoints(themeId)?.let { points >= it } ?: false
}


enum class AppRole { STUDENT, TEACHER, SUB_ADMIN, ADMIN, UNKNOWN;
    companion object {
        fun from(value: String?): AppRole = when (value) {
            "admin" -> ADMIN
            "sub_admin" -> SUB_ADMIN
            "teacher" -> TEACHER
            "student" -> STUDENT
            else -> UNKNOWN
        }
    }
}

data class NotificationItem(
    val id: String,
    val type: String,
    val title: String,
    val body: String?,
    val link: String?,
    val actorName: String?,
    val actorAvatar: String?,
    val priority: String,
    val read: Boolean,
    val createdAt: String
)

data class ConversationSummary(
    val id: String,
    val isGroup: Boolean,
    val title: String,
    val avatarUrl: String?,
    val otherUserId: String?,
    val lastMessage: String?,
    val lastMessageAt: String?,
    val unreadCount: Int,
    val blocked: Boolean
)

data class ChatMessage(
    val id: String,
    val conversationId: String,
    val senderId: String,
    val senderName: String,
    val senderAvatar: String?,
    val content: String,
    val createdAt: String,
    val pending: Boolean = false,
    val failed: Boolean = false
)

data class LeaderboardEntry(
    val id: String,
    val fullName: String,
    val avatarUrl: String?,
    val major: String?,
    val year: Int?,
    val points: Int,
    val verified: Boolean,
    val universityNumber: String,
    val rank: Int
)

data class AdminUserRow(
    val id: String,
    val fullName: String,
    val universityNumber: String,
    val avatarUrl: String?,
    val major: String?,
    val year: Int?,
    val role: String,
    val points: Int,
    val verified: Boolean,
    val banned: Boolean,
    val suspendedUntil: String?
)

data class PostReport(
    val id: String,
    val postId: String,
    val postContent: String?,
    val reporterId: String,
    val reporterName: String?,
    val reason: String,
    val createdAt: String
)

data class MessageReport(
    val id: String,
    val conversationId: String,
    val reporterId: String,
    val reporterName: String?,
    val reportedUserId: String,
    val reportedUserName: String?,
    val reason: String,
    val note: String?,
    val createdAt: String
)

data class BannedWord(val id: String, val word: String)

data class AdminActivityItem(
    val id: String,
    val activityType: String,
    val description: String,
    val userName: String?,
    val createdAt: String
)

data class AdminStats(
    val totalUsers: Int = 0,
    val totalPosts: Int = 0,
    val totalCourses: Int = 0,
    val pendingReports: Int = 0,
    val dailyPosts: List<Pair<String, Int>> = emptyList(),
    val dailyRegistrations: List<Pair<String, Int>> = emptyList()
)

data class SearchResults(
    val people: List<PublicProfile> = emptyList(),
    val posts: List<FeedPost> = emptyList(),
    val courses: List<Course> = emptyList()
)

data class MessagingState(
    val conversations: List<ConversationSummary> = emptyList(),
    val activeConversationId: String? = null,
    val activeOtherUserId: String? = null,
    val activeTitle: String = "",
    val activeBlocked: Boolean = false,
    val messages: List<ChatMessage> = emptyList(),
    val unreadTotal: Int = 0,
    val loading: Boolean = false,
    val sending: Boolean = false
)

data class NotificationsState(
    val items: List<NotificationItem> = emptyList(),
    val unreadCount: Int = 0,
    val loading: Boolean = false
)

data class SearchState(
    val query: String = "",
    val results: SearchResults = SearchResults(),
    val recent: List<String> = emptyList(),
    val loading: Boolean = false
)

data class LeaderboardState(
    val entries: List<LeaderboardEntry> = emptyList(),
    val myRank: LeaderboardEntry? = null,
    val major: String? = null,
    val year: Int? = null,
    val loading: Boolean = false
)

enum class AdminTab(val label: String) {
    OVERVIEW("نظرة عامة"),
    USERS("المستخدمون"),
    REPORTS("البلاغات"),
    WORDS("الكلمات المحظورة"),
    COURSES("المقررات"),
    NAME_REQUESTS("طلبات الأسماء"),
    SUBADMINS("المشرفون المساعدون"),
    ACTIVITY("سجل النشاط")
}

data class AdminCourseRow(val id: String, val name: String, val major: String?, val year: Int?, val semester: Int?, val teacherName: String?)
data class NameChangeRequestRow(val id: String, val userId: String, val currentName: String, val requestedName: String, val reason: String?, val status: String, val createdAt: String)
data class SubAdminRow(val userId: String, val fullName: String, val avatarUrl: String?, val canCourses: Boolean, val canReports: Boolean, val canSuspend: Boolean, val canTeachers: Boolean, val canWarn: Boolean, val canWords: Boolean)

data class AdminState(
    val role: AppRole = AppRole.UNKNOWN,
    val users: List<AdminUserRow> = emptyList(),
    val postReports: List<PostReport> = emptyList(),
    val messageReports: List<MessageReport> = emptyList(),
    val bannedWords: List<BannedWord> = emptyList(),
    val courses: List<AdminCourseRow> = emptyList(),
    val nameRequests: List<NameChangeRequestRow> = emptyList(),
    val subAdmins: List<SubAdminRow> = emptyList(),
    val activity: List<AdminActivityItem> = emptyList(),
    val stats: AdminStats = AdminStats(),
    val tab: AdminTab = AdminTab.OVERVIEW,
    val loading: Boolean = false
)
