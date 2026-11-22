package com.nexus.app.data.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isAuthenticated: Boolean = false
)

class AuthViewModel(
    private val repository: AuthRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState = _uiState.asStateFlow()

    fun signIn(identifier: String, password: String) {
        if (identifier.isBlank() || password.isBlank()) return
        viewModelScope.launch {
            _uiState.value = AuthUiState(isLoading = true)
            runCatching { repository.signIn(identifier, password) }
                .onSuccess {
                    _uiState.value = AuthUiState(isAuthenticated = true)
                }
                .onFailure { error ->
                    _uiState.value = AuthUiState(
                        errorMessage = error.message ?: "تعذر تسجيل الدخول"
                    )
                }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            runCatching { repository.signOut() }
            _uiState.value = AuthUiState()
        }
    }

    class Factory(
        private val repository: AuthRepository
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(AuthViewModel::class.java))
            return AuthViewModel(repository) as T
        }
    }
}
