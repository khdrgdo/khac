package com.nexus.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage

@Composable
fun NexusAvatar(url: String?, name: String, size: Int, modifier: Modifier = Modifier) {
    var failed by remember(url) { mutableStateOf(false) }
    val imageUrl = url?.trim()?.takeIf { it.startsWith("https://") || it.startsWith("http://") }
    if (imageUrl != null && !failed) {
        AsyncImage(model = imageUrl, contentDescription = "الصورة الشخصية", modifier = modifier.size(size.dp).clip(CircleShape),
            contentScale = ContentScale.Crop, onError = { failed = true })
    } else {
        Surface(shape = CircleShape, color = MaterialTheme.colorScheme.secondaryContainer, modifier = modifier.size(size.dp)) {
            Box(contentAlignment = Alignment.Center) {
                Text(name.trim().firstOrNull()?.uppercase() ?: "N", color = MaterialTheme.colorScheme.onSecondaryContainer, fontWeight = FontWeight.Bold)
            }
        }
    }
}
