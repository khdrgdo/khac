package com.nexus.app.data.auth

import android.content.Context
import com.nexus.app.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

class AuthRepository(context: Context) {
    private val client: SupabaseClient? = NexusSupabaseClient.get(context.applicationContext)

    val isConfigured: Boolean
        get() = BuildConfig.SUPABASE_PUBLISHABLE_KEY.isNotBlank()

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

    suspend fun signOut() {
        client?.auth?.signOut()
    }
}
