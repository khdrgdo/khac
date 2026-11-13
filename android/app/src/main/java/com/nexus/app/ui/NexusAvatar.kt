package com.nexus.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
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
    Box(modifier.size(size.dp).clip(CircleShape).background(MaterialTheme.colorScheme.secondaryContainer), contentAlignment = Alignment.Center) {
        Text(name.trim().firstOrNull()?.uppercase() ?: "N", color = MaterialTheme.colorScheme.onSecondaryContainer, fontWeight = FontWeight.Bold)
        if (imageUrl != null && !failed) AsyncImage(model = imageUrl, contentDescription = "الصورة الشخصية", modifier = Modifier.size(size.dp).clip(CircleShape),
            contentScale = ContentScale.Crop, onError = { failed = true })
    }
}
