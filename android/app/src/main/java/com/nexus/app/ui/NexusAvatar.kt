package com.nexus.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage

@Composable
fun NexusAvatar(url: String?, name: String, size: Int, anonymous: Boolean = false) {
    var failed by remember(url) { mutableStateOf(false) }
    val fallback = @Composable {
        Box(Modifier.size(size.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) {
            Text(if (anonymous) "؟" else name.trim().firstOrNull()?.uppercase() ?: "N", color = MaterialTheme.colorScheme.onPrimaryContainer, fontWeight = FontWeight.Bold)
        }
    }
    if (!anonymous && !url.isNullOrBlank() && url.startsWith("http") && !failed) {
        AsyncImage(model = url, contentDescription = "الصورة الشخصية", modifier = Modifier.size(size.dp).clip(CircleShape), onError = { failed = true })
    } else fallback()
}
