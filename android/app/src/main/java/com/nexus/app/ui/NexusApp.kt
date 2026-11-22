package com.nexus.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.nexus.app.data.account.AccountRepository
import com.nexus.app.data.auth.AuthRepository
import com.nexus.app.data.auth.AuthScreen
import com.nexus.app.data.auth.AuthViewModel
import com.nexus.app.ui.auth.AccountStatusScreen
import com.nexus.app.ui.auth.CompleteProfileScreen
import com.nexus.app.ui.auth.EmailConfirmationScreen
import com.nexus.app.ui.auth.ForgotPasswordScreen
import com.nexus.app.ui.auth.ForcedPasswordChangeScreen
import com.nexus.app.ui.auth.ResetPasswordScreen
import com.nexus.app.ui.auth.SignInScreen
import com.nexus.app.ui.auth.SignUpScreen

@Composable
fun NexusApp() {
    val context = LocalContext.current.applicationContext
    val authRepository = remember(context) { AuthRepository(context) }
    val accountRepository = remember(context) { AccountRepository(context) }
    val authViewModel: AuthViewModel = viewModel(
        factory = remember(authRepository, accountRepository) {
            AuthViewModel.Factory(authRepository, accountRepository)
        }
    )
    val state by authViewModel.uiState.collectAsStateWithLifecycle()
    val profile = state.account?.profile

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        when {
            !authRepository.isConfigured -> ConfigurationRequiredScreen()
            state.screen == AuthScreen.RESET_PASSWORD -> ResetPasswordScreen(
                isLoading = state.isLoading,
                errorMessage = state.errorMessage,
                onUpdatePassword = authViewModel::updatePassword
            )
            state.screen == AuthScreen.ACCOUNT_BANNED -> AccountStatusScreen(
                title = "الحساب موقوف نهائياً",
                message = "تم إيقاف هذا الحساب من إدارة NEXUS. تواصل مع الإدارة إذا كنت ترى أن القرار غير صحيح.",
                actionLabel = "تسجيل الخروج",
                onAction = authViewModel::signOut
            )
            state.screen == AuthScreen.ACCOUNT_SUSPENDED -> AccountStatusScreen(
                title = "الحساب موقوف مؤقتاً",
                message = "لا يمكن استخدام الحساب خلال فترة الإيقاف. تنتهي الفترة: ${profile?.suspendedUntil ?: "غير محدد"}.",
                actionLabel = "تسجيل الخروج",
                onAction = authViewModel::signOut
            )
            state.screen == AuthScreen.FORCED_PASSWORD_CHANGE -> ForcedPasswordChangeScreen(
                isLoading = state.isLoading,
                errorMessage = state.errorMessage,
                onSave = authViewModel::updatePassword,
                onSignOut = authViewModel::signOut
            )
            state.screen == AuthScreen.COMPLETE_PROFILE -> CompleteProfileScreen(
                initialName = profile?.fullName.orEmpty(),
                initialUniversityNumber = profile?.universityNumber.orEmpty(),
                initialMajor = profile?.major,
                initialYear = profile?.year,
                isLoading = state.isLoading,
                errorMessage = state.errorMessage,
                onSave = authViewModel::completeProfile,
                onSignOut = authViewModel::signOut
            )
            state.screen == AuthScreen.ACCOUNT_LOAD_ERROR -> AccountStatusScreen(
                title = "تعذر تحميل الحساب",
                message = state.errorMessage ?: "تعذر التحقق من بيانات الحساب والصلاحيات.",
                actionLabel = "إعادة المحاولة",
                onAction = authViewModel::retryAccountLoad,
                secondaryLabel = "تسجيل الخروج",
                onSecondary = authViewModel::signOut
            )
            state.isAuthenticated && state.account != null -> SignedInScreen(
                accountName = state.account!!.profile.fullName,
                role = state.account!!.primaryRole,
                onSignOut = authViewModel::signOut
            )
            state.screen == AuthScreen.SIGN_UP -> SignUpScreen(
                isLoading = state.isLoading,
                errorMessage = state.errorMessage,
                onSignUp = authViewModel::signUp,
                onBackToSignIn = { authViewModel.navigateTo(AuthScreen.SIGN_IN) }
            )
            state.screen == AuthScreen.FORGOT_PASSWORD -> ForgotPasswordScreen(
                isLoading = state.isLoading,
                errorMessage = state.errorMessage,
                onRequestReset = authViewModel::requestPasswordReset,
                onBackToSignIn = { authViewModel.navigateTo(AuthScreen.SIGN_IN) }
            )
            state.screen == AuthScreen.EMAIL_CONFIRMATION -> EmailConfirmationScreen(
                email = state.pendingEmail,
                message = state.infoMessage,
                onBackToSignIn = { authViewModel.navigateTo(AuthScreen.SIGN_IN) }
            )
            else -> SignInScreen(
                isLoading = state.isLoading,
                errorMessage = state.errorMessage,
                infoMessage = state.infoMessage,
                onSignIn = authViewModel::signIn,
                onGoogleSignIn = authViewModel::signInWithGoogle,
                onForgotPassword = { authViewModel.navigateTo(AuthScreen.FORGOT_PASSWORD) },
                onCreateAccount = { authViewModel.navigateTo(AuthScreen.SIGN_UP) }
            )
        }
    }
}

@Composable
private fun ConfigurationRequiredScreen() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.Start
    ) {
        Text(
            text = "NEXUS",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.Bold
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = "الاتصال بالخادم غير مهيأ",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "لم يتم تضمين مفتاح Supabase العام في إعداد البناء. لن نعرض بيانات تجريبية أو نوهمك بأن تسجيل الدخول يعمل.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun SignedInScreen(
    accountName: String,
    role: String,
    onSignOut: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.Start
    ) {
        Text(
            text = "NEXUS",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.Bold
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = "مرحباً، $accountName",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "تم تحميل دور الحساب: $role. أقسام المجتمع والملف الشخصي والإدارة ستُفعّل بعد ربط مستودعاتها بالخادم.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(24.dp))
        Button(onClick = onSignOut) {
            Text("تسجيل الخروج")
        }
    }
}
