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
import androidx.compose.ui.text.style.TextOverflow
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
        else -> listOf(Color(0xFF172554), Color(0xFF334155))
    }
    Scaffold(topBar = { TopAppBar(title = { Text("الملف الشخصي") }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowForward, "رجوع") } }) }) { padding ->
        when {
            state.publicProfileLoading && detail == null -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            detail == null -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { Text("الملف الشخصي غير متاح") }
            else -> LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                item {
                    Column {
                        Box(Modifier.fillMaxWidth().height(142.dp).background(Brush.horizontalGradient(palette))) {
                            Row(Modifier.align(Alignment.TopEnd).padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                                Surface(color = Color.Black.copy(alpha = .18f), shape = RoundedCornerShape(20.dp)) { Text("NEXUS MEMBER", Modifier.padding(horizontal = 12.dp, vertical = 7.dp), color = Color.White, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold) }
                            }
                        }
                        Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp).offset(y = (-42).dp), verticalAlignment = Alignment.Bottom) {
                            Surface(shape = CircleShape, color = MaterialTheme.colorScheme.surface, border = androidx.compose.foundation.BorderStroke(4.dp, MaterialTheme.colorScheme.surface), modifier = Modifier.size(104.dp)) {
                                Box(contentAlignment = Alignment.Center) {
                                    if (!profile?.avatarUrl.isNullOrBlank()) AsyncImage(model = profile?.avatarUrl, contentDescription = "الصورة الشخصية", modifier = Modifier.fillMaxSize().clip(CircleShape))
                                    else Text(profile?.fullName?.firstOrNull()?.toString() ?: "N", style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.primary)
                                }
                            }
                            Spacer(Modifier.weight(1f))
                            Button(onClick = { profile?.id?.let(onMessage) }, modifier = Modifier.padding(bottom = 7.dp), shape = RoundedCornerShape(12.dp)) { Icon(Icons.Outlined.Chat, null); Spacer(Modifier.width(7.dp)); Text("مراسلة") }
                        }
                        Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp).offset(y = (-30).dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(profile?.fullName.orEmpty(), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                                if (detail.profile.verified) { Spacer(Modifier.width(6.dp)); Icon(Icons.Outlined.Verified, "حساب موثق", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp)) }
                            }
                            Text(listOfNotNull(profile?.major?.uppercase(), profile?.year?.let { "السنة الدراسية $it" }).joinToString("  ·  ").ifBlank { "عضو في مجتمع NEXUS" }, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (!profile?.bio.isNullOrBlank()) Text(profile?.bio.orEmpty(), style = MaterialTheme.typography.bodyLarge)
                            Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Outlined.EmojiEvents, null, tint = MaterialTheme.colorScheme.tertiary, modifier = Modifier.size(18.dp))
                                Text("${profile?.points ?: 0} نقطة", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                                Text("·", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text("عضو نشط", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatTile("المنشورات", detail.postsCount.toString(), Modifier.weight(1f))
                        StatTile("التعليقات", detail.commentsCount.toString(), Modifier.weight(1f))
                        StatTile("إجابات معتمدة", detail.acceptedAnswers.toString(), Modifier.weight(1f))
                    }
                }
                item { Row(Modifier.fillMaxWidth().padding(horizontal = 17.dp), verticalAlignment = Alignment.CenterVertically) { Text("النشاط والمنشورات", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold); Spacer(Modifier.weight(1f)); Text("${detail.posts.size} منشور", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
                if (detail.posts.isEmpty()) item { Text("لا توجد منشورات ظاهرة حتى الآن", Modifier.fillMaxWidth().padding(22.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                items(detail.posts, key = { it.id }) { post ->
                    Card(onClick = { onOpenPost(post.id) }, modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp), shape = RoundedCornerShape(17.dp), border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = RoundedCornerShape(8.dp)) { Icon(if (post.postType == "question") Icons.Outlined.HelpOutline else Icons.Outlined.Article, null, Modifier.padding(7.dp), tint = MaterialTheme.colorScheme.onSecondaryContainer) }
                                Spacer(Modifier.width(9.dp)); Column(Modifier.weight(1f)) { Text(if (post.postType == "question") "سؤال" else "منشور", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold); Text(post.createdAt.take(10), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                                Icon(Icons.Outlined.ChevronLeft, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Text(post.content, style = MaterialTheme.typography.bodyLarge, maxLines = 6, overflow = TextOverflow.Ellipsis)
                            post.images.take(2).forEach { AsyncImage(it, "صورة المنشور", Modifier.fillMaxWidth().heightIn(max = 230.dp).clip(RoundedCornerShape(12.dp))) }
                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .6f))
                            Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Outlined.ModeComment, null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant); Spacer(Modifier.width(6.dp)); Text("${post.commentsCount} تعليق", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant); Spacer(Modifier.weight(1f)); Text("عرض النقاش", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatTile(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier, shape = RoundedCornerShape(15.dp), border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(vertical = 13.dp, horizontal = 7.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
        }
    }
}
