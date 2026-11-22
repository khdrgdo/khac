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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.nexus.app.BuildConfig
import com.nexus.app.data.auth.AuthRepository
import com.nexus.app.data.auth.AuthViewModel
import com.nexus.app.ui.auth.SignInScreen

@Composable
fun NexusApp() {
    val repository = remember { AuthRepository() }
    val viewModel: AuthViewModel = viewModel(
        factory = remember(repository) { AuthViewModel.Factory(repository) }
    )
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        when {
            BuildConfig.SUPABASE_PUBLISHABLE_KEY.isBlank() -> ConfigurationRequiredScreen()
            state.isAuthenticated -> SignedInScreen(onSignOut = viewModel::signOut)
            else -> SignInScreen(
                isLoading = state.isLoading,
                errorMessage = state.errorMessage,
                onSignIn = viewModel::signIn
            )
        }
    }
}

@Composable
private fun ConfigurationRequiredScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 28.dp),
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
private fun SignedInScreen(onSignOut: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(28.dp),
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
            text = "تم تسجيل الدخول",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "جلسة المصادقة تعمل. ستظهر أقسام الحساب بعد تحميل الملف الشخصي والصلاحيات من الخادم.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(24.dp))
        Button(onClick = onSignOut) {
            Text("تسجيل الخروج")
        }
    }
}
