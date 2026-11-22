package com.nexus.app.data.auth

import android.content.Intent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

object AuthDeepLinkBus {
    private val _passwordRecoveryRequested = MutableStateFlow(false)
    val passwordRecoveryRequested = _passwordRecoveryRequested.asStateFlow()

    fun publish(intent: Intent) {
        val uri = intent.data ?: return
        val isRecovery = uri.path.orEmpty().contains("reset-password") ||
            uri.getQueryParameter("type") == "recovery"
        if (isRecovery) _passwordRecoveryRequested.value = true
    }

    fun clear() {
        _passwordRecoveryRequested.value = false
    }
}
