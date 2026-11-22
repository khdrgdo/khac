package com.nexus.app.data.auth

import android.content.Context
import com.nexus.app.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.FlowType
import io.github.jan.supabase.createSupabaseClient

object NexusSupabaseClient {
    @Volatile
    private var instance: SupabaseClient? = null

    fun get(context: Context): SupabaseClient? {
        if (BuildConfig.SUPABASE_PUBLISHABLE_KEY.isBlank()) return null
        instance?.let { return it }

        return synchronized(this) {
            instance ?: createSupabaseClient(
                supabaseUrl = BuildConfig.SUPABASE_URL,
                supabaseKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY
            ) {
                install(Auth) {
                    sessionManager = KeystoreSessionManager(context.applicationContext)
                    flowType = FlowType.PKCE
                    scheme = "nexus"
                    host = "auth"
                    autoLoadFromStorage = true
                    autoSaveToStorage = true
                    alwaysAutoRefresh = true
                    enableLifecycleCallbacks = true
                }
            }.also { instance = it }
        }
    }
}
