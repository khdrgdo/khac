package com.nexus.app.data.auth

import android.content.Context
import com.nexus.app.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class AuthRepository(context: Context) {
    private val client: SupabaseClient? = NexusSupabaseClient.get(context.applicationContext)

    val isConfigured: Boolean
        get() = BuildConfig.SUPABASE_URL.isNotBlank() &&
            BuildConfig.SUPABASE_PUBLISHABLE_KEY.isNotBlank()

    val sessionStatus: Flow<SessionStatus>
        get() = client?.auth?.sessionStatus ?: flowOf(SessionStatus.NotAuthenticated())

    suspend fun signIn(identifier: String, password: String) {
        val supabase = client ?: error("اتصال Supabase غير مهيأ لهذا البناء")
        val email = AuthIdentifier.toAuthEmail(identifier)
        supabase.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signUp(
        fullName: String,
        universityNumber: String,
        email: String,
        major: String,
        year: Int,
        password: String
    ) {
        val supabase = client ?: error("اتصال Supabase غير مهيأ لهذا البناء")
        supabase.auth.signUpWith(Email, redirectUrl = "nexus://auth/confirm") {
            this.email = email.trim()
            this.password = password
            data = buildJsonObject {
                put("university_number", universityNumber.trim())
                put("full_name", fullName.trim())
                put("major", major)
                put("year", year)
            }
        }
    }

    suspend fun signInWithGoogle() {
        val supabase = client ?: error("اتصال Supabase غير مهيأ لهذا البناء")
        supabase.auth.signInWith(Google, redirectUrl = "nexus://auth/callback")
    }

    suspend fun requestPasswordReset(email: String) {
        val supabase = client ?: error("اتصال Supabase غير مهيأ لهذا البناء")
        supabase.auth.resetPasswordForEmail(
            email = email.trim(),
            redirectUrl = "nexus://auth/reset-password"
        )
    }

    suspend fun updatePassword(newPassword: String) {
        val supabase = client ?: error("اتصال Supabase غير مهيأ لهذا البناء")
        supabase.auth.updateUser {
            password = newPassword
        }
    }

    suspend fun signOut() {
        client?.auth?.signOut()
    }
}
