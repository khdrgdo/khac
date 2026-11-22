package com.nexus.app.data.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class AuthScreen {
    SIGN_IN,
    SIGN_UP,
    FORGOT_PASSWORD,
    EMAIL_CONFIRMATION,
    RESET_PASSWORD
}

data class AuthUiState(
    val screen: AuthScreen = AuthScreen.SIGN_IN,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val infoMessage: String? = null,
    val pendingEmail: String? = null,
    val isAuthenticated: Boolean = false
)

class AuthViewModel(
    private val repository: AuthRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState = _uiState.asStateFlow()

    init {
        if (repository.isConfigured) {
            viewModelScope.launch {
                repository.sessionStatus.collect { status ->
                    _uiState.value = when (status) {
                        is SessionStatus.Authenticated -> _uiState.value.copy(
                            isLoading = false,
                            isAuthenticated = true,
                            errorMessage = null
                        )
                        SessionStatus.Initializing -> _uiState.value.copy(isLoading = true)
                        is SessionStatus.RefreshFailure -> _uiState.value.copy(
                            isLoading = false,
                            isAuthenticated = false,
                            errorMessage = "انتهت الجلسة وتعذر تجديدها. سجّل الدخول مجدداً."
                        )
                        is SessionStatus.NotAuthenticated -> _uiState.value.copy(
                            isLoading = false,
                            isAuthenticated = false
                        )
                    }
                }
            }

            viewModelScope.launch {
                AuthDeepLinkBus.passwordRecoveryRequested.collect { requested ->
                    if (requested) {
                        _uiState.value = _uiState.value.copy(
                            screen = AuthScreen.RESET_PASSWORD,
                            isAuthenticated = false,
                            isLoading = false,
                            errorMessage = null,
                            infoMessage = null
                        )
                    }
                }
            }
        }
    }

    fun navigateTo(screen: AuthScreen) {
        _uiState.value = _uiState.value.copy(
            screen = screen,
            isLoading = false,
            errorMessage = null,
            infoMessage = null
        )
    }

    fun signIn(identifier: String, password: String) {
        if (identifier.isBlank() || password.isBlank()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = true,
                errorMessage = null,
                infoMessage = null
            )
            runCatching { repository.signIn(identifier, password) }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "تعذر تسجيل الدخول"
                    )
                }
        }
    }

    fun signInWithGoogle() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching { repository.signInWithGoogle() }
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        infoMessage = "أكمل تسجيل الدخول في نافذة Google."
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "تعذر بدء تسجيل الدخول عبر Google"
                    )
                }
        }
    }

    fun signUp(
        fullName: String,
        universityNumber: String,
        email: String,
        major: String,
        year: Int?,
        password: String,
        confirmation: String
    ) {
        val invalid = when {
            fullName.trim().length < 2 -> "أدخل الاسم الكامل"
            universityNumber.trim().length < 5 -> "الرقم الجامعي يجب أن يتكون من 5 خانات على الأقل"
            !email.contains("@") -> "أدخل بريداً إلكترونياً صحيحاً"
            major !in setOf("it", "is", "se") -> "اختر التخصص"
            year == null || year !in 1..4 -> "اختر السنة الدراسية"
            password.length < 6 -> "كلمة المرور يجب ألا تقل عن 6 أحرف"
            password != confirmation -> "كلمتا المرور غير متطابقتين"
            else -> null
        }
        if (invalid != null) {
            _uiState.value = _uiState.value.copy(errorMessage = invalid)
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching {
                repository.signUp(
                    fullName,
                    universityNumber,
                    email,
                    major,
                    year!!,
                    password
                )
            }.onSuccess {
                _uiState.value = _uiState.value.copy(
                    screen = AuthScreen.EMAIL_CONFIRMATION,
                    isLoading = false,
                    pendingEmail = email.trim(),
                    infoMessage = "إذا كان تأكيد البريد مفعلاً، افتح رسالة التفعيل قبل تسجيل الدخول."
                )
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = error.message ?: "تعذر إنشاء الحساب"
                )
            }
        }
    }

    fun requestPasswordReset(email: String) {
        if (!email.contains("@")) {
            _uiState.value = _uiState.value.copy(errorMessage = "أدخل بريداً إلكترونياً صحيحاً")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching { repository.requestPasswordReset(email) }
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        screen = AuthScreen.EMAIL_CONFIRMATION,
                        isLoading = false,
                        pendingEmail = email.trim(),
                        infoMessage = "إذا كان البريد مرتبطاً بحساب، فستصلك رسالة لاستعادة كلمة المرور."
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "تعذر إرسال رابط الاستعادة"
                    )
                }
        }
    }

    fun updatePassword(password: String, confirmation: String) {
        val invalid = when {
            password.length < 6 -> "كلمة المرور يجب ألا تقل عن 6 أحرف"
            password != confirmation -> "كلمتا المرور غير متطابقتين"
            else -> null
        }
        if (invalid != null) {
            _uiState.value = _uiState.value.copy(errorMessage = invalid)
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching { repository.updatePassword(password) }
                .onSuccess {
                    AuthDeepLinkBus.clear()
                    _uiState.value = AuthUiState(
                        screen = AuthScreen.SIGN_IN,
                        infoMessage = "تم تحديث كلمة المرور. سجّل الدخول من جديد."
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "تعذر تحديث كلمة المرور"
                    )
                }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            runCatching { repository.signOut() }
                .onSuccess {
                    AuthDeepLinkBus.clear()
                    _uiState.value = AuthUiState()
                }
                .onFailure {
                    _uiState.value = _uiState.value.copy(
                        errorMessage = "تعذر تسجيل الخروج. حاول مرة أخرى."
                    )
                }
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
