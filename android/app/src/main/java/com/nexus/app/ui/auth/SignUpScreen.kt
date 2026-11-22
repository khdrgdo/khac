package com.nexus.app.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.Alignment

@Composable
fun SignUpScreen(
    isLoading: Boolean,
    errorMessage: String?,
    onSignUp: (String, String, String, String, Int?, String, String) -> Unit,
    onBackToSignIn: () -> Unit
) {
    var fullName by remember { mutableStateOf("") }
    var universityNumber by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var major by remember { mutableStateOf("") }
    var year by remember { mutableStateOf<Int?>(null) }
    var password by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf("") }
    var majorMenu by remember { mutableStateOf(false) }
    var yearMenu by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("إنشاء حساب طالب", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        Text(
            "أدخل بياناتك الأكاديمية كما هي في سجلات الجامعة.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(20.dp))
        OutlinedTextField(
            value = fullName,
            onValueChange = { fullName = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("الاسم الكامل") },
            singleLine = true
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = universityNumber,
            onValueChange = { universityNumber = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("الرقم الجامعي") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii)
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("البريد الإلكتروني") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
        )
        Spacer(Modifier.height(10.dp))
        Box {
            OutlinedTextField(
                value = when (major) {
                    "it" -> "تقنية المعلومات (IT)"
                    "is" -> "نظم المعلومات (IS)"
                    "se" -> "هندسة البرمجيات (SE)"
                    else -> ""
                },
                onValueChange = {},
                modifier = Modifier.fillMaxWidth(),
                readOnly = true,
                label = { Text("التخصص") },
                placeholder = { Text("اختر التخصص") },
                trailingIcon = {
                    TextButton(onClick = { majorMenu = true }) { Text("اختيار") }
                }
            )
            DropdownMenu(
                expanded = majorMenu,
                onDismissRequest = { majorMenu = false }
            ) {
                listOf(
                    "it" to "تقنية المعلومات (IT)",
                    "is" to "نظم المعلومات (IS)",
                    "se" to "هندسة البرمجيات (SE)"
                ).forEach { (code, label) ->
                    DropdownMenuItem(
                        text = { Text(label) },
                        onClick = { major = code; majorMenu = false }
                    )
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        Box {
            OutlinedTextField(
                value = year?.let { "السنة $it" }.orEmpty(),
                onValueChange = {},
                modifier = Modifier.fillMaxWidth(),
                readOnly = true,
                label = { Text("السنة الدراسية") },
                placeholder = { Text("اختر السنة") },
                trailingIcon = {
                    TextButton(onClick = { yearMenu = true }) { Text("اختيار") }
                }
            )
            DropdownMenu(
                expanded = yearMenu,
                onDismissRequest = { yearMenu = false }
            ) {
                (1..4).forEach { item ->
                    DropdownMenuItem(
                        text = { Text("السنة $item") },
                        onClick = { year = item; yearMenu = false }
                    )
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("كلمة المرور") },
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
            onClick = { onSignUp(fullName, universityNumber, email, major, year, password, confirmation) },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            enabled = !isLoading
        ) {
            if (isLoading) CircularProgressIndicator(modifier = Modifier.height(20.dp))
            else Text("إنشاء الحساب")
        }
        TextButton(onClick = onBackToSignIn, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text("العودة لتسجيل الدخول")
        }
    }
}
