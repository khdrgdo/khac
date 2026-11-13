package com.nexus.app.data

enum class AppScreen {
    LOGIN, HOME, FEED, COURSES, COURSE_DETAIL, PROFILE, CHANGE_PASSWORD
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
    val suspendedUntil: String?
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
    val commentsCount: Int
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
