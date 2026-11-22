package com.nexus.app.data.auth

import com.nexus.app.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.createSupabaseClient

class AuthRepository {
    private val client: SupabaseClient? by lazy {
        if (BuildConfig.SUPABASE_PUBLISHABLE_KEY.isBlank()) {
            null
        } else {
            createSupabaseClient(
                supabaseUrl = BuildConfig.SUPABASE_URL,
                supabaseKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY
            ) {
                install(Auth)
            }
        }
    }

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
