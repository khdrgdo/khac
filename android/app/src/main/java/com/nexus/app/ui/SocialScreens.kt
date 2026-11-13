package com.nexus.app.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
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
    onPublish: (String, Boolean, String) -> Unit,
    onComment: (String, String) -> Unit,
    onUploadImage: (Uri) -> Unit,
    onRemoveImage: (String) -> Unit,
    onReact: (String, String?) -> Unit,
    onSave: (String, Boolean) -> Unit,
    onReport: (String, String) -> Unit,
    onDelete: (String) -> Unit,
    onHome: () -> Unit,
    onCourses: () -> Unit,
    onLeaderboard: () -> Unit,
    onSaved: () -> Unit,
    onNotifications: () -> Unit,
    onMessages: () -> Unit,
    onProfile: () -> Unit
) {
    var draft by rememberSaveable { mutableStateOf("") }
    var anonymous by rememberSaveable { mutableStateOf(false) }
    var question by rememberSaveable { mutableStateOf(false) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        uris.take((4 - state.draftImagePaths.size).coerceAtLeast(0)).forEach(onUploadImage)
    }
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(true, onHome, icon = { Icon(Icons.Outlined.Home, null) }, label = { Text("الرئيسية") })
                NavigationBarItem(false, onCourses, icon = { Icon(Icons.Outlined.MenuBook, null) }, label = { Text("المقررات") })
                NavigationBarItem(false, onLeaderboard, icon = { Icon(Icons.Outlined.EmojiEvents, null) }, label = { Text("الصدارة") })
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
                        Text("الرئيسية", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                        Text("شارك المعرفة وناقش أفكارك مع زملائك", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    IconButton(onClick = onSaved) { Icon(Icons.Outlined.Bookmarks, "المحفوظات") }
                    IconButton(onClick = onNotifications) { Icon(Icons.Outlined.NotificationsNone, "الإشعارات") }
                    IconButton(onClick = onMessages) { Icon(Icons.Outlined.ChatBubbleOutline, "المحادثات") }
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
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(selected = !question, onClick = { question = false }, label = { Text("منشور") })
                            FilterChip(selected = question, onClick = { question = true }, label = { Text("سؤال") })
                            Spacer(Modifier.weight(1f))
                            IconButton(onClick = { picker.launch("image/*") }, enabled = state.draftImagePaths.size < 4) { Icon(Icons.Outlined.AddPhotoAlternate, "إرفاق صور") }
                        }
                        if (state.draftImagePaths.isNotEmpty()) {
                            Text("الصور المرفقة (${state.draftImagePaths.size}/4)", style = MaterialTheme.typography.labelMedium)
                            state.draftImagePaths.forEach { path ->
                                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Outlined.Image, null, tint = MaterialTheme.colorScheme.secondary)
                                    Text(path.substringAfterLast('/'), Modifier.weight(1f), maxLines = 1)
                                    IconButton(onClick = { onRemoveImage(path) }) { Icon(Icons.Outlined.Close, "إزالة الصورة") }
                                }
                            }
                        }
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(checked = anonymous, onCheckedChange = { anonymous = it })
                                Text("نشر مجهولاً", style = MaterialTheme.typography.bodyMedium)
                            }
                            Button(onClick = { onPublish(draft, anonymous, if (question) "question" else "general"); draft = ""; anonymous = false; question = false }, enabled = (draft.isNotBlank() || state.draftImagePaths.isNotEmpty()) && !state.busy) {
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
                FeedPostCard(post = post, busy = state.busy, ownPost = post.authorId == state.profile?.id,
                    onComment = { text -> onComment(post.id, text) }, onReact = { onReact(post.id, it) },
                    onSave = { onSave(post.id, post.saved) }, onReport = { onReport(post.id, it) }, onDelete = { onDelete(post.id) })
            }
        }
    }
}

@Composable
private fun FeedPostCard(post: FeedPost, busy: Boolean, ownPost: Boolean, onComment: (String) -> Unit,
    onReact: (String?) -> Unit, onSave: () -> Unit, onReport: (String) -> Unit, onDelete: () -> Unit) {
    var reply by rememberSaveable(post.id) { mutableStateOf("") }
    var reportOpen by rememberSaveable(post.id) { mutableStateOf(false) }
    var reportReason by rememberSaveable(post.id) { mutableStateOf("محتوى غير لائق أو مسيء") }
    var deleteOpen by rememberSaveable(post.id) { mutableStateOf(false) }
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
            if (post.images.isNotEmpty()) {
                post.images.forEach { imageUrl -> AsyncImage(model = imageUrl, contentDescription = "صورة في المنشور",
                    modifier = Modifier.fillMaxWidth().heightIn(max = 360.dp).clip(RoundedCornerShape(12.dp))) }
            }
            if (post.postType == "question") {
                AssistChip(onClick = {}, label = { Text(if (post.acceptedAnswerId == null) "سؤال مفتوح" else "تمت الإجابة") },
                    leadingIcon = { Icon(if (post.acceptedAnswerId == null) Icons.Outlined.HelpOutline else Icons.Outlined.CheckCircle, null) })
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("like" to "👍", "love" to "❤️", "haha" to "😂", "wow" to "😮", "sad" to "😢").forEach { (type, emoji) ->
                    val count = post.reactions.count { it.type == type }
                    AssistChip(onClick = { onReact(if (post.myReaction == type) null else type) },
                        label = { Text(if (count > 0) "$emoji $count" else emoji) },
                        leadingIcon = if (post.myReaction == type) ({ Icon(Icons.Outlined.Check, null) }) else null)
                }
                AssistChip(onClick = onSave, label = { Text(if (post.saved) "محفوظ" else "حفظ") },
                    leadingIcon = { Icon(if (post.saved) Icons.Outlined.Bookmark else Icons.Outlined.BookmarkBorder, null) })
                if (!ownPost) AssistChip(onClick = { reportOpen = true }, label = { Text("بلاغ") }, leadingIcon = { Icon(Icons.Outlined.Flag, null) })
                if (ownPost) AssistChip(onClick = { deleteOpen = true }, label = { Text("حذف") }, leadingIcon = { Icon(Icons.Outlined.DeleteOutline, null) })
            }
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
    if (reportOpen) AlertDialog(onDismissRequest = { reportOpen = false }, title = { Text("الإبلاغ عن المنشور") },
        text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("محتوى غير لائق أو مسيء", "تنمّر أو تحرّش", "معلومات مضللة", "بريد مزعج / إعلان", "أخرى").forEach { reason ->
                Row(verticalAlignment = Alignment.CenterVertically) { RadioButton(selected = reportReason == reason, onClick = { reportReason = reason }); Text(reason) }
            }
        } }, confirmButton = { TextButton(onClick = { onReport(reportReason); reportOpen = false }) { Text("إرسال البلاغ") } },
        dismissButton = { TextButton(onClick = { reportOpen = false }) { Text("إلغاء") } })
    if (deleteOpen) AlertDialog(onDismissRequest = { deleteOpen = false }, title = { Text("حذف المنشور؟") },
        text = { Text("لن يظهر المنشور بعد حذفه.") }, confirmButton = { TextButton(onClick = { onDelete(); deleteOpen = false }) { Text("حذف") } },
        dismissButton = { TextButton(onClick = { deleteOpen = false }) { Text("إلغاء") } })
}
