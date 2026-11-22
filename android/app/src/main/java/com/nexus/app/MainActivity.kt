package com.nexus.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import com.nexus.app.data.auth.AuthDeepLinkBus
import com.nexus.app.data.auth.NexusSupabaseClient
import com.nexus.app.ui.NexusApp
import com.nexus.app.ui.theme.NexusTheme
import io.github.jan.supabase.auth.handleDeeplinks

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        NexusSupabaseClient.get(applicationContext)?.handleDeeplinks(intent)
        AuthDeepLinkBus.publish(intent)
        enableEdgeToEdge()
        setContent {
            NexusTheme(darkTheme = isSystemInDarkTheme()) {
                NexusApp()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        NexusSupabaseClient.get(applicationContext)?.handleDeeplinks(intent)
        AuthDeepLinkBus.publish(intent)
    }
}
