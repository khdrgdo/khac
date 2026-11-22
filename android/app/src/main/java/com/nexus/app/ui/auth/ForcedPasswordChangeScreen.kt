package com.nexus.app.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun ForcedPasswordChangeScreen(
    isLoading: Boolean,
    errorMessage: String?,
    onSave: (String, String) -> Unit,
    onSignOut: () -> Unit
) {
    var password by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf("") }
    Column(
        modifier = Modifier.fillMaxSize().imePadding().padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("تغيير كلمة المرور مطلوب", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        Text(
            "لحماية حسابك، يجب تعيين كلمة مرور جديدة قبل متابعة استخدام المنصة.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(20.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("كلمة المرور الجديدة") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation()
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = confirmation,
            onValueChange = { confirmation = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("تأكيد كلمة المرور") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation()
        )
        if (errorMessage != null) {
            Spacer(Modifier.height(10.dp))
            Text(errorMessage, color = MaterialTheme.colorScheme.error)
        }
        Spacer(Modifier.height(18.dp))
        Button(
            onClick = { onSave(password, confirmation) },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            enabled = !isLoading && password.isNotBlank() && confirmation.isNotBlank()
        ) {
            if (isLoading) CircularProgressIndicator(modifier = Modifier.height(20.dp))
            else Text("تحديث كلمة المرور")
        }
        androidx.compose.material3.TextButton(onClick = onSignOut) {
            Text("تسجيل الخروج")
        }
    }
}
