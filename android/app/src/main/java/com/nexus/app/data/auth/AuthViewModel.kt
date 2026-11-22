package com.nexus.app.data.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.nexus.app.data.account.AccountRepository
import com.nexus.app.data.account.AccountSnapshot
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant

enum class AuthScreen {
    SIGN_IN,
    SIGN_UP,
    FORGOT_PASSWORD,
    EMAIL_CONFIRMATION,
    RESET_PASSWORD,
    COMPLETE_PROFILE,
    FORCED_PASSWORD_CHANGE,
    ACCOUNT_BANNED,
    ACCOUNT_SUSPENDED,
    ACCOUNT_LOAD_ERROR
}

data class AuthUiState(
    val screen: AuthScreen = AuthScreen.SIGN_IN,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val infoMessage: String? = null,
    val pendingEmail: String? = null,
    val isAuthenticated: Boolean = false,
    val account: AccountSnapshot? = null
)

class AuthViewModel(
    private val repository: AuthRepository,
    private val accountRepository: AccountRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState = _uiState.asStateFlow()
    private var accountLoadInProgress = false

    init {
        if (repository.isConfigured) {
            viewModelScope.launch {
                repository.sessionStatus.collect { status ->
                    when (status) {
                        is SessionStatus.Authenticated -> {
                            if (_uiState.value.screen != AuthScreen.RESET_PASSWORD) {
                                loadAccount()
                            }
                        }
                        SessionStatus.Initializing -> {
                            _uiState.value = _uiState.value.copy(isLoading = true)
                        }
                        is SessionStatus.RefreshFailure -> {
                            _uiState.value = _uiState.value.copy(
                                isLoading = false,
                                isAuthenticated = false,
                                account = null,
                                errorMessage = "انتهت الجلسة وتعذر تجديدها. سجّل الدخول مجدداً."
                            )
                        }
                        is SessionStatus.NotAuthenticated -> {
                            if (_uiState.value.screen != AuthScreen.RESET_PASSWORD) {
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    isAuthenticated = false,
                                    account = null
                                )
                            }
                        }
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

    private fun loadAccount() {
        if (accountLoadInProgress) return
        accountLoadInProgress = true
        viewModelScope.launch {
            try {
                _uiState.value = _uiState.value.copy(
                    isLoading = true,
                    errorMessage = null
                )
                val account = accountRepository.loadCurrentAccount()
                val profile = account.profile
                val now = Instant.now()
                val nextScreen = when {
                    profile.banned -> AuthScreen.ACCOUNT_BANNED
                    profile.suspendedUntil?.isAfter(now) == true -> AuthScreen.ACCOUNT_SUSPENDED
                    profile.mustChangePassword -> AuthScreen.FORCED_PASSWORD_CHANGE
                    !profile.isProfileComplete -> AuthScreen.COMPLETE_PROFILE
                    else -> AuthScreen.SIGN_IN
                }
                _uiState.value = _uiState.value.copy(
                    screen = nextScreen,
                    isLoading = false,
                    isAuthenticated = nextScreen == AuthScreen.SIGN_IN,
                    account = account,
                    errorMessage = null
                )
            } catch (error: Throwable) {
                _uiState.value = _uiState.value.copy(
                    screen = AuthScreen.ACCOUNT_LOAD_ERROR,
                    isLoading = false,
                    isAuthenticated = false,
                    errorMessage = error.message ?: "تعذر تحميل بيانات الحساب"
                )
            } finally {
                accountLoadInProgress = false
            }
        }
    }

    fun retryAccountLoad() {
        loadAccount()
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
                    infoMessage = "افتح رسالة التفعيل إذا كان تأكيد البريد مفعلاً."
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
            runCatching {
                repository.updatePassword(password)
                accountRepository.completeForcedPasswordChange()
            }
                .onSuccess {
                    AuthDeepLinkBus.clear()
                    loadAccount()
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "تعذر تحديث كلمة المرور"
                    )
                }
        }
    }

    fun completeProfile(
        fullName: String,
        universityNumber: String,
        major: String,
        year: Int
    ) {
        val invalid = when {
            fullName.trim().length < 2 -> "أدخل الاسم الكامل"
            universityNumber.trim().length < 5 -> "أدخل رقماً جامعياً صحيحاً"
            major !in setOf("it", "is", "se") -> "اختر التخصص"
            year !in 1..4 -> "السنة الدراسية غير صحيحة"
            else -> null
        }
        if (invalid != null) {
            _uiState.value = _uiState.value.copy(errorMessage = invalid)
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching {
                accountRepository.updateProfile(fullName, universityNumber, major, year)
            }.onSuccess {
                loadAccount()
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = error.message ?: "تعذر حفظ الملف الأكاديمي"
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
        private val repository: AuthRepository,
        private val accountRepository: AccountRepository
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(AuthViewModel::class.java))
            return AuthViewModel(repository, accountRepository) as T
        }
    }
}
