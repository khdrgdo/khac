package com.nexus.app.ui

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material.icons.outlined.OpenInNew
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.BuildConfig
import com.nexus.app.data.NexusUiState
import com.nexus.app.ui.theme.nexus

/**
 * Login is a single rising panel, not a card floating on a blank page: a violet masthead
 * carries the brand and the one line that matters, the form sits directly on the page
 * (no card-inside-a-card), and the only loud color is the sign-in button.
 */
@Composable
fun NexusLoginScreen(
    state: NexusUiState,
    onSignIn: (String, String) -> Unit,
    onRecover: (String) -> Unit
) {
    val context = LocalContext.current
    var identifier by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    var recoveryOpen by rememberSaveable { mutableStateOf(false) }
    var recoveryIdentifier by rememberSaveable { mutableStateOf("") }

    fun openWebsiteAuth(tab: String) {
        val url = Uri.parse(BuildConfig.WEB_AUTH_URL.trimEnd('/') + "/auth").buildUpon()
            .appendQueryParameter("tab", tab)
            .appendQueryParameter("redirect_to", "com.nexus.app://login-callback")
            .build()
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, url)) }
            .onFailure { Toast.makeText(context, "تعذّر فتح بوابة الدخول", Toast.LENGTH_SHORT).show() }
    }

    val fieldColors = TextFieldDefaults.colors(
        unfocusedContainerColor = MaterialTheme.colorScheme.surface,
        focusedContainerColor = MaterialTheme.colorScheme.surface
    )

    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).verticalScroll(rememberScrollState())) {
        // Masthead: the brand lives here, not in a floating logo row above a card.
        Box(
            Modifier.fillMaxWidth()
                .heightIn(min = 190.dp)
                .background(Brush.linearGradient(listOf(MaterialTheme.nexus.brandEnd, MaterialTheme.nexus.brandStart), start = Offset(0f, 0f), end = Offset(1000f, 1000f)))
                .padding(horizontal = 26.dp, vertical = 30.dp)
        ) {
            Column(Modifier.align(Alignment.CenterStart)) {
                Text("NEXUS", color = androidx.compose.ui.graphics.Color.White, style = MaterialTheme.typography.displayLarge.copy(fontSize = 34.sp, letterSpacing = 2.sp))
                Spacer(Modifier.height(10.dp))
                Text(
                    "مقرراتك ومجتمعك وإنجازاتك، في مكان واحد.",
                    color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.92f),
                    style = MaterialTheme.typography.titleMedium
                )
            }
        }

        Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 28.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("تسجيل الدخول", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)

            OutlinedTextField(
                value = identifier,
                onValueChange = { identifier = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("الرقم الجامعي أو البريد الإلكتروني") },
                leadingIcon = { Icon(Icons.Outlined.PersonOutline, contentDescription = null) },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = fieldColors,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
            )
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("كلمة المرور") },
                leadingIcon = { Icon(Icons.Outlined.Lock, contentDescription = null) },
                trailingIcon = {
                    IconButton(onClick = { showPassword = !showPassword }) {
                        Icon(
                            if (showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                            contentDescription = if (showPassword) "إخفاء كلمة المرور" else "إظهار كلمة المرور"
                        )
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = fieldColors,
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
            )

            if (!state.error.isNullOrBlank()) {
                Surface(color = MaterialTheme.colorScheme.errorContainer, shape = RoundedCornerShape(10.dp)) {
                    Text(state.error, Modifier.fillMaxWidth().padding(11.dp), color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodySmall)
                }
            }

            Button(
                onClick = { onSignIn(identifier.trim(), password) },
                enabled = !state.busy && identifier.isNotBlank() && password.isNotBlank(),
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
            ) {
                if (state.busy) CircularProgressIndicator(Modifier.size(18.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                else Text("دخول إلى NEXUS", fontWeight = FontWeight.Bold)
            }

            TextButton(onClick = { recoveryIdentifier = identifier; recoveryOpen = true }, modifier = Modifier.align(Alignment.End)) {
                Text("نسيت كلمة المرور؟", color = MaterialTheme.colorScheme.secondary)
            }

            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                HorizontalDivider(Modifier.weight(1f), color = MaterialTheme.colorScheme.outlineVariant)
                Text("أو", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
                HorizontalDivider(Modifier.weight(1f), color = MaterialTheme.colorScheme.outlineVariant)
            }

            OutlinedButton(onClick = { openWebsiteAuth("login") }, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(12.dp)) {
                Icon(Icons.Outlined.OpenInNew, contentDescription = null, modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(8.dp))
                Text("المتابعة عبر Google أو الموقع")
            }

            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                Text("ليس لديك حساب؟", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = { openWebsiteAuth("signup") }) { Text("إنشاء حساب جديد", fontWeight = FontWeight.SemiBold) }
            }
        }
    }

    if (recoveryOpen) {
        AlertDialog(
            onDismissRequest = { recoveryOpen = false },
            title = { Text("استعادة كلمة المرور") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("أدخل الرقم الجامعي أو البريد المرتبط بحسابك.")
                    OutlinedTextField(
                        value = recoveryIdentifier, onValueChange = { recoveryIdentifier = it },
                        modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text("بيانات الحساب") }
                    )
                }
            },
            confirmButton = {
                TextButton(enabled = !state.busy && recoveryIdentifier.isNotBlank(), onClick = {
                    onRecover(recoveryIdentifier.trim()); recoveryOpen = false
                }) { Text("إرسال رابط الاستعادة") }
            },
            dismissButton = { TextButton(onClick = { recoveryOpen = false }) { Text("إلغاء") } }
        )
    }
}
