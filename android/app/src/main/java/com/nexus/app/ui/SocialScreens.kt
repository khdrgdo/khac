package com.nexus.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.nexus.app.data.*

@Composable
fun SocialFeedScreen(
    state: NexusUiState,
    onRefresh: () -> Unit,
    onPublish: (String, Boolean) -> Unit,
    onComment: (String, String) -> Unit,
    onHome: () -> Unit,
    onCourses: () -> Unit,
    onProfile: () -> Unit
) {
    var draft by rememberSaveable { mutableStateOf("") }
    var anonymous by rememberSaveable { mutableStateOf(false) }
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(false, onHome, icon = { Icon(Icons.Outlined.Home, null) }, label = { Text("الرئيسية") })
                NavigationBarItem(true, {}, icon = { Icon(Icons.Outlined.Groups, null) }, label = { Text("المجتمع") })
                NavigationBarItem(false, onCourses, icon = { Icon(Icons.Outlined.MenuBook, null) }, label = { Text("المقررات") })
                NavigationBarItem(false, onProfile, icon = { Icon(Icons.Outlined.PersonOutline, null) }, label = { Text("حسابي") })
            }
        }, containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("المجتمع الطلابي", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                        Text("شارك المعرفة وناقش أفكارك مع زملائك", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    IconButton(onClick = onRefresh, enabled = !state.loading) { Icon(Icons.Outlined.Refresh, "تحديث") }
                }
            }
            item {
                Card(shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("ابدأ نقاشاً", style = MaterialTheme.typography.titleMedium)
                        OutlinedTextField(
                            value = draft, onValueChange = { draft = it }, modifier = Modifier.fillMaxWidth(),
                            placeholder = { Text("ما الذي تود مشاركته مع زملائك؟") }, minLines = 3, maxLines = 6,
                            shape = RoundedCornerShape(13.dp)
                        )
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(checked = anonymous, onCheckedChange = { anonymous = it })
                                Text("نشر مجهولاً", style = MaterialTheme.typography.bodyMedium)
                            }
                            Button(onClick = { onPublish(draft, anonymous); draft = ""; anonymous = false }, enabled = draft.isNotBlank() && !state.busy) {
                                if (state.busy) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                                else { Icon(Icons.Outlined.Send, null); Spacer(Modifier.width(6.dp)); Text("نشر") }
                            }
                        }
                    }
                }
            }
            if (!state.error.isNullOrBlank()) item { Text(state.error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            if (state.loading && state.feedPosts.isEmpty()) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            if (!state.loading && state.feedPosts.isEmpty()) item {
                Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.Forum, null, modifier = Modifier.size(38.dp), tint = MaterialTheme.colorScheme.secondary)
                    Text("لا توجد منشورات بعد", style = MaterialTheme.typography.titleMedium)
                    Text("كن أول من يبدأ الحوار في مجتمع NEXUS", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            items(state.feedPosts, key = { it.id }) { post ->
                FeedPostCard(post = post, busy = state.busy, onComment = { text -> onComment(post.id, text) })
            }
        }
    }
}

@Composable
private fun FeedPostCard(post: FeedPost, busy: Boolean, onComment: (String) -> Unit) {
    var reply by rememberSaveable(post.id) { mutableStateOf("") }
    Card(shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (!post.avatarUrl.isNullOrBlank()) AsyncImage(post.avatarUrl, null, Modifier.size(42.dp).clip(CircleShape))
                else Box(Modifier.size(42.dp).clip(CircleShape), contentAlignment = Alignment.Center) {
                    Surface(shape = CircleShape, color = MaterialTheme.colorScheme.secondaryContainer) {
                        Box(Modifier.size(42.dp), contentAlignment = Alignment.Center) { Text(post.authorName.take(1), fontWeight = FontWeight.Bold) }
                    }
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(post.authorName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text(if (post.anonymous) "منشور مجهول" else post.createdAt.take(10), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (post.postType == "question") AssistChip(onClick = {}, label = { Text("سؤال") })
            }
            Text(post.content, style = MaterialTheme.typography.bodyLarge)
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.ModeComment, null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(5.dp))
                Text("${post.commentsCount} تعليق", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(reply, { reply = it }, Modifier.weight(1f), placeholder = { Text("اكتب تعليقاً...") }, singleLine = true, shape = RoundedCornerShape(12.dp))
                Spacer(Modifier.width(7.dp))
                IconButton(onClick = { onComment(reply); reply = "" }, enabled = reply.isNotBlank() && !busy) { Icon(Icons.Outlined.Send, "إرسال التعليق") }
            }
        }
    }
}
