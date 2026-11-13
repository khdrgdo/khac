package com.nexus.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nexus.app.data.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PublicProfileScreen(state: NexusUiState, onBack: () -> Unit, onMessage: (String) -> Unit, onOpenPost: (String) -> Unit) {
    val detail = state.publicProfile
    val profile = detail?.profile
    val palette = when(profile?.theme) {
        "clouds" -> listOf(Color(0xFF0C4A6E), Color(0xFF164E63))
        "moon" -> listOf(Color(0xFF2E1065), Color(0xFF312E81))
        "sun" -> listOf(Color(0xFF7C2D12), Color(0xFF78350F))
        "galaxy" -> listOf(Color(0xFF581C87), Color(0xFF831843))
        else -> listOf(Color(0xFF0F172A), Color(0xFF312E81))
    }
    Scaffold(topBar = { TopAppBar(title = { Text("الملف الشخصي") }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowForward, "رجوع") } }) }) { padding ->
        if (state.publicProfileLoading && detail == null) LinearProgressIndicator(Modifier.fillMaxWidth().padding(padding))
        else if (detail == null) Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { Text("الملف الشخصي غير متاح") }
        else LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Brush.linearGradient(palette)).padding(18.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (!profile?.avatarUrl.isNullOrBlank()) StudentAvatar(profile?.avatarUrl, profile?.fullName ?: "طالب", 64)
                            else Surface(shape = CircleShape, color = Color.White.copy(alpha=.18f), modifier = Modifier.size(64.dp)) { Box(contentAlignment = Alignment.Center) { Text(profile?.fullName?.take(1) ?: "N", color = Color.White, style = MaterialTheme.typography.headlineSmall) } }
                            Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f)) {
                                Text(profile?.fullName.orEmpty(), color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                                Text(listOfNotNull(profile?.major?.uppercase(), profile?.year?.let { "السنة $it" }).joinToString(" • "), color = Color.White.copy(alpha=.85f), style = MaterialTheme.typography.bodySmall)
                                Text("${profile?.points ?: 0} نقطة", color = Color.White, style = MaterialTheme.typography.labelMedium)
                            }
                        }
                        if (!profile?.bio.isNullOrBlank()) Text(profile?.bio.orEmpty(), color = Color.White.copy(alpha=.9f), style = MaterialTheme.typography.bodyMedium)
                        Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                            Surface(color = Color.White.copy(alpha=.16f), shape = RoundedCornerShape(50)) { Row(Modifier.padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Outlined.Stars, null, tint = Color.White, modifier = Modifier.size(15.dp)); Spacer(Modifier.width(5.dp)); Text("${profile?.points ?: 0} نقطة", color = Color.White, style = MaterialTheme.typography.labelMedium) } }
                            Surface(color = Color.White.copy(alpha=.16f), shape = RoundedCornerShape(50)) { Text(if ((profile?.points ?: 0) >= 1500) "ماسي" else if ((profile?.points ?: 0) >= 700) "بلاتيني" else if ((profile?.points ?: 0) >= 300) "ذهبي" else if ((profile?.points ?: 0) >= 100) "فضي" else "برونزي", Modifier.padding(horizontal = 10.dp, vertical = 6.dp), color = Color.White, style = MaterialTheme.typography.labelMedium) }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { profile?.id?.let(onMessage) }, colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = palette.first())) { Icon(Icons.Outlined.Chat, null); Spacer(Modifier.width(6.dp)); Text("مراسلة") }
                            Surface(color = Color.White.copy(alpha=.15f), shape = RoundedCornerShape(12.dp)) { Text("إطار ${profile?.theme ?: "stars"}", Modifier.padding(horizontal = 10.dp, vertical = 9.dp), color = Color.White, style = MaterialTheme.typography.labelMedium) }
                        }
                    }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatTile("المنشورات", detail.postsCount.toString(), Modifier.weight(1f))
                    StatTile("التعليقات", detail.commentsCount.toString(), Modifier.weight(1f))
                    StatTile("إجابات معتمدة", detail.acceptedAnswers.toString(), Modifier.weight(1f))
                }
            }
            item {
                Text("النشاط والمساهمات", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("المحتوى المنشور والمشاركات الظاهرة في المجتمع", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (detail.posts.isEmpty()) item { Text("لا توجد منشورات ظاهرة", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(18.dp)) }
            items(detail.posts, key = { it.id }) { post ->
                Card(onClick = { onOpenPost(post.id) }, shape = RoundedCornerShape(18.dp), border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) { Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = RoundedCornerShape(8.dp)) { Text(if (post.postType == "question") "سؤال" else "منشور", Modifier.padding(horizontal = 9.dp, vertical = 5.dp), color = MaterialTheme.colorScheme.onSecondaryContainer, style = MaterialTheme.typography.labelSmall) }
                        Spacer(Modifier.weight(1f)); Text(post.createdAt.take(10), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text(post.content, style = MaterialTheme.typography.bodyLarge, maxLines = 5)
                    post.images.forEach { AsyncImage(it, "صورة", Modifier.fillMaxWidth().heightIn(max = 260.dp)) }
                    Text("${post.commentsCount} تعليق", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                } }
            }
        }
    }
}

@Composable
private fun StatTile(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier, shape = RoundedCornerShape(13.dp)) { Column(Modifier.fillMaxWidth().padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    } }
}
