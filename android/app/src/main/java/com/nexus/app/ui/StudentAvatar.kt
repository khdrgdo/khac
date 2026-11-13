package com.nexus.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import coil.compose.AsyncImagePainter

@Composable
fun StudentAvatar(url: String?, name: String, size: Int, modifier: Modifier = Modifier) {
    val shape = Modifier.size(size.dp).clip(CircleShape)
    if (url.isNullOrBlank()) {
        Box(shape.then(modifier).background(MaterialTheme.colorScheme.secondaryContainer), contentAlignment = Alignment.Center) {
            Text(name.trim().firstOrNull()?.toString() ?: "؟", color = MaterialTheme.colorScheme.onSecondaryContainer, fontSize = (size * .38f).sp, fontWeight = FontWeight.Bold)
        }
    } else {
        SubcomposeAsyncImage(model = url, contentDescription = "صورة $name", modifier = shape.then(modifier)) {
            when (painter.state) {
                is AsyncImagePainter.State.Success -> SubcomposeAsyncImageContent()
                else -> Box(Modifier.size(size.dp).background(MaterialTheme.colorScheme.secondaryContainer), contentAlignment = Alignment.Center) {
                    Text(name.trim().firstOrNull()?.toString() ?: "؟", color = MaterialTheme.colorScheme.onSecondaryContainer, fontSize = (size * .38f).sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
