package com.nexus.app.data.account

import android.content.Context
import com.nexus.app.data.auth.NexusSupabaseClient
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.result.decodeList
import io.github.jan.supabase.postgrest.result.decodeSingle
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import java.time.OffsetDateTime

data class NexusProfile(
    val id: String,
    val fullName: String,
    val universityNumber: String,
    val email: String?,
    val major: String?,
    val year: Int?,
    val bio: String?,
    val avatarUrl: String?,
    val points: Int,
    val verified: Boolean,
    val banned: Boolean,
    val suspendedUntil: Instant?,
    val mustChangePassword: Boolean,
    val hideUniversityNumber: Boolean,
    val cardThemeId: String?,
    val theme: String?
) {
    val isProfileComplete: Boolean
        get() = fullName.isNotBlank() &&
            fullName != "مستخدم جديد" &&
            universityNumber.isNotBlank() &&
            !universityNumber.startsWith("PENDING-") &&
            !major.isNullOrBlank() &&
            year != null
}

data class SubAdminPermissions(
    val canWarn: Boolean = false,
    val canSuspend: Boolean = false,
    val canCourses: Boolean = false,
    val canReports: Boolean = false,
    val canWords: Boolean = false,
    val canTeachers: Boolean = false,
    val canUsers: Boolean = false
)

data class AccountSnapshot(
    val userId: String,
    val profile: NexusProfile,
    val roles: Set<String>,
    val permissions: SubAdminPermissions?
) {
    val primaryRole: String
        get() = when {
            "admin" in roles -> "admin"
            "sub_admin" in roles -> "sub_admin"
            "teacher" in roles -> "teacher"
            "student" in roles -> "student"
            else -> "unknown"
        }
}

class AccountRepository(context: Context) {
    private val client: SupabaseClient? =
        NexusSupabaseClient.get(context.applicationContext)

    suspend fun loadCurrentAccount(): AccountSnapshot {
        val supabase = client ?: error("اتصال Supabase غير مهيأ")
        val user = supabase.auth.currentUserOrNull() ?: error("انتهت جلسة الدخول")
        val userId = user.id

        val profileJson = supabase.from("profiles").select {
            filter { eq("id", userId) }
        }.decodeSingle<JsonObject>()

        val roleRows = supabase.from("user_roles").select {
            filter { eq("user_id", userId) }
        }.decodeList<JsonObject>()

        val roles = roleRows.mapNotNull { it.text("role") }.toSet()
        if (roles.isEmpty()) error("الحساب لا يملك دوراً مسجلاً. راجع إدارة النظام.")

        val permissions = if ("sub_admin" in roles) {
            val rows = supabase.from("subadmin_permissions").select {
                filter { eq("user_id", userId) }
            }.decodeList<JsonObject>()
            rows.firstOrNull()?.let { row ->
                SubAdminPermissions(
                    canWarn = row.flag("can_warn"),
                    canSuspend = row.flag("can_suspend"),
                    canCourses = row.flag("can_courses"),
                    canReports = row.flag("can_reports"),
                    canWords = row.flag("can_words"),
                    canTeachers = row.flag("can_teachers"),
                    canUsers = row.flag("can_users")
                )
            } ?: SubAdminPermissions()
        } else null

        val suspendedUntil = profileJson.text("suspended_until")?.let { value ->
            runCatching { OffsetDateTime.parse(value).toInstant() }.getOrNull()
        }

        val profile = NexusProfile(
            id = profileJson.text("id") ?: userId,
            fullName = profileJson.text("full_name").orEmpty(),
            universityNumber = profileJson.text("university_number").orEmpty(),
            email = profileJson.text("email") ?: user.email,
            major = profileJson.text("major"),
            year = profileJson.number("year"),
            bio = profileJson.text("bio"),
            avatarUrl = profileJson.text("avatar_url"),
            points = profileJson.number("points") ?: 0,
            verified = profileJson.flag("verified"),
            banned = profileJson.flag("banned"),
            suspendedUntil = suspendedUntil,
            mustChangePassword = profileJson.flag("must_change_password"),
            hideUniversityNumber = profileJson.flag("hide_university_number"),
            cardThemeId = profileJson.text("card_theme_id"),
            theme = profileJson.text("theme")
        )

        return AccountSnapshot(
            userId = userId,
            profile = profile,
            roles = roles,
            permissions = permissions
        )
    }

    suspend fun updateProfile(
        fullName: String,
        universityNumber: String,
        major: String,
        year: Int
    ) {
        val supabase = client ?: error("اتصال Supabase غير مهيأ")
        if (supabase.auth.currentUserOrNull() == null) error("انتهت جلسة الدخول")

        supabase.postgrest.rpc(
            "complete_profile",
            parameters = buildJsonObject {
                put("_full_name", fullName.trim())
                put("_university_number", universityNumber.trim())
                put("_major", major)
                put("_year", year)
            }
        )
    }

    suspend fun completeForcedPasswordChange() {
        val supabase = client ?: error("اتصال Supabase غير مهيأ")
        supabase.postgrest.rpc("complete_forced_password_change")
    }
}

private fun JsonObject.text(key: String): String? =
    this[key]?.jsonPrimitive?.contentOrNull

private fun JsonObject.number(key: String): Int? =
    this[key]?.jsonPrimitive?.intOrNull

private fun JsonObject.flag(key: String): Boolean =
    this[key]?.jsonPrimitive?.booleanOrNull ?: false
