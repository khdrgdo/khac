package com.nexus.app.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.combinedClickable
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
    onSearch: () -> Unit,
    onVotePinnedCard: (String) -> Unit,
    onParticipatePinnedCard: () -> Unit,
    onOpenPinnedAction: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    onOpenProfile: (String) -> Unit,
    onShare: (String) -> Unit,
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
                    IconButton(onClick = onSearch) { Icon(Icons.Outlined.Search, "بحث") }
                    IconButton(onClick = onSaved) { Icon(Icons.Outlined.Bookmarks, "المحفوظات") }
                    IconButton(onClick = onNotifications) { Icon(Icons.Outlined.NotificationsNone, "الإشعارات") }
                    IconButton(onClick = onMessages) { Icon(Icons.Outlined.ChatBubbleOutline, "المحادثات") }
                    IconButton(onClick = onRefresh, enabled = !state.loading) { Icon(Icons.Outlined.Refresh, "تحديث") }
                }
            }
            item { PinnedEventCard(state.pinnedCard, state.profile, onVotePinnedCard, onParticipatePinnedCard, onOpenPinnedAction) }
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
                    onSave = { onSave(post.id, post.saved) }, onReport = { onReport(post.id, it) }, onDelete = { onDelete(post.id) }, onOpenPost = { onOpenPost(post.id) }, onOpenProfile = { post.authorId?.let(onOpenProfile) }, onShare = { onShare(post.content) })
            }
        }
    }
}

@Composable
private fun FeedPostCard(post: FeedPost, busy: Boolean, ownPost: Boolean, onComment: (String) -> Unit,
    onReact: (String?) -> Unit, onSave: () -> Unit, onReport: (String) -> Unit, onDelete: () -> Unit, onOpenPost: () -> Unit, onOpenProfile: () -> Unit, onShare: () -> Unit) {
    var reply by rememberSaveable(post.id) { mutableStateOf("") }
    var reportOpen by rememberSaveable(post.id) { mutableStateOf(false) }
    var reportReason by rememberSaveable(post.id) { mutableStateOf("محتوى غير لائق أو مسيء") }
    var deleteOpen by rememberSaveable(post.id) { mutableStateOf(false) }
    var reactionMenu by rememberSaveable(post.id) { mutableStateOf(false) }
    var moreMenu by rememberSaveable(post.id) { mutableStateOf(false) }
    val reactions = listOf("like" to "👍", "love" to "❤️", "haha" to "😂", "wow" to "😮", "sad" to "😢")
    val totalReactions = post.reactions.size
    val topReactions = post.reactions.groupingBy { it.type }.eachCount().entries.sortedByDescending { it.value }.take(3)
    val selectedEmoji = reactions.firstOrNull { it.first == post.myReaction }?.second ?: "👍"
    Card(shape = RoundedCornerShape(10.dp), border = BorderStroke(0.7.dp, MaterialTheme.colorScheme.outlineVariant), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth()) {
            Row(Modifier.fillMaxWidth().padding(start = 14.dp, end = 6.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                if (!post.avatarUrl.isNullOrBlank() && !post.anonymous) AsyncImage(model = post.avatarUrl, contentDescription = null, modifier = Modifier.size(44.dp).clip(CircleShape))
                else Surface(shape = CircleShape, color = MaterialTheme.colorScheme.secondaryContainer, modifier = Modifier.size(44.dp)) { Box(contentAlignment = Alignment.Center) { Text(if (post.anonymous) "؟" else post.authorName.take(1), fontWeight = FontWeight.Bold) } }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    TextButton(onClick = onOpenProfile, contentPadding = PaddingValues(0.dp), enabled = !post.anonymous) { Text(post.authorName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface) }
                    Text((if (post.anonymous) "منشور مجهول" else post.createdAt.take(16).replace('T',' ')) + if (post.postType == "question") " · سؤال" else "", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Box {
                    IconButton(onClick = { moreMenu = true }) { Icon(Icons.Outlined.MoreHoriz, "المزيد") }
                    DropdownMenu(expanded = moreMenu, onDismissRequest = { moreMenu = false }) {
                        DropdownMenuItem(text = { Text(if (post.saved) "إزالة من المحفوظات" else "حفظ المنشور") }, leadingIcon = { Icon(Icons.Outlined.BookmarkBorder, null) }, onClick = { onSave(); moreMenu = false })
                        DropdownMenuItem(text = { Text("مشاركة") }, leadingIcon = { Icon(Icons.Outlined.Share, null) }, onClick = { onShare(); moreMenu = false })
                        if (!ownPost) DropdownMenuItem(text = { Text("الإبلاغ عن المنشور") }, leadingIcon = { Icon(Icons.Outlined.Flag, null) }, onClick = { reportOpen = true; moreMenu = false })
                        if (ownPost) DropdownMenuItem(text = { Text("حذف المنشور", color = MaterialTheme.colorScheme.error) }, leadingIcon = { Icon(Icons.Outlined.DeleteOutline, null, tint = MaterialTheme.colorScheme.error) }, onClick = { deleteOpen = true; moreMenu = false })
                    }
                }
            }
            if (post.content.isNotBlank()) Text(post.content, Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp), style = MaterialTheme.typography.bodyLarge)
            if (post.images.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) { post.images.take(4).forEach { imageUrl ->
                    AsyncImage(model = imageUrl, contentDescription = "صورة في المنشور", modifier = Modifier.fillMaxWidth().heightIn(min = 160.dp, max = 360.dp).clip(RoundedCornerShape(4.dp)))
                } }
            }
            if (post.postType == "question") Row(Modifier.padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(if (post.acceptedAnswerId == null) Icons.Outlined.HelpOutline else Icons.Outlined.CheckCircle, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(6.dp)); Text(if (post.acceptedAnswerId == null) "سؤال ينتظر الإجابة" else "تم اعتماد إجابة", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            }
            if (totalReactions > 0 || post.commentsCount > 0) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .6f))
                Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        topReactions.forEach { entry -> Text(reactions.firstOrNull { it.first == entry.key }?.second ?: "👍", modifier = Modifier.offset(x = (-3 * topReactions.indexOf(entry)).dp), fontSize = 17.sp) }
                        if (totalReactions > 0) Text("$totalReactions", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Spacer(Modifier.weight(1f))
                    if (post.commentsCount > 0) Text("${post.commentsCount} تعليق", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .6f))
            Row(Modifier.fillMaxWidth().height(50.dp).padding(horizontal = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) {
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(9.dp)).combinedClickable(onClick = { onReact(if (post.myReaction == null) "like" else null) }, onLongClick = { reactionMenu = true }).padding(vertical = 8.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                        Text(selectedEmoji, fontSize = 19.sp); Spacer(Modifier.width(6.dp)); Text(if (post.myReaction == null) "أعجبني" else when(post.myReaction) { "love" -> "أحببته"; "haha" -> "أضحكني"; "wow" -> "أدهشني"; "sad" -> "أحزنني"; else -> "أعجبني" }, style = MaterialTheme.typography.labelLarge, color = if (post.myReaction != null) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, fontWeight = FontWeight.SemiBold)
                    }
                    DropdownMenu(expanded = reactionMenu, onDismissRequest = { reactionMenu = false }) {
                        Column(Modifier.padding(horizontal = 10.dp, vertical = 7.dp)) {
                            Text("اختر تفاعلك", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) { reactions.forEach { (type, emoji) ->
                                TextButton(onClick = { onReact(if (post.myReaction == type) null else type); reactionMenu = false }, contentPadding = PaddingValues(horizontal = 3.dp, vertical = 5.dp)) { Text(emoji, fontSize = 25.sp) }
                            } }
                        }
                    }
                }
                TextButton(onClick = onOpenPost, modifier = Modifier.weight(1f)) { Icon(Icons.Outlined.ModeComment, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("تعليق", style = MaterialTheme.typography.labelLarge) }
                TextButton(onClick = onShare, modifier = Modifier.weight(1f)) { Icon(Icons.Outlined.Share, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("مشاركة", style = MaterialTheme.typography.labelLarge) }
            }
            Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 8.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(reply, { reply = it }, Modifier.weight(1f), placeholder = { Text("اكتب تعليقاً...") }, singleLine = true, shape = RoundedCornerShape(22.dp))
                IconButton(onClick = { onComment(reply.trim()); reply = "" }, enabled = reply.isNotBlank() && !busy) { Icon(Icons.Outlined.Send, "إرسال التعليق") }
            }
        }
    }
    if (reportOpen) AlertDialog(onDismissRequest = { reportOpen = false }, title = { Text("الإبلاغ عن المنشور") }, text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("محتوى غير لائق أو مسيء", "تنمّر أو تحرّش", "معلومات مضللة", "بريد مزعج / إعلان", "انتحال شخصية", "أخرى").forEach { reason -> Row(verticalAlignment = Alignment.CenterVertically) { RadioButton(selected = reportReason == reason, onClick = { reportReason = reason }); Text(reason) } }
    } }, confirmButton = { TextButton(onClick = { onReport(reportReason); reportOpen = false }) { Text("إرسال البلاغ") } }, dismissButton = { TextButton(onClick = { reportOpen = false }) { Text("إلغاء") } })
    if (deleteOpen) AlertDialog(onDismissRequest = { deleteOpen = false }, title = { Text("حذف المنشور؟") }, text = { Text("لن يظهر المنشور بعد حذفه.") }, confirmButton = { TextButton(onClick = { onDelete(); deleteOpen = false }) { Text("حذف") } }, dismissButton = { TextButton(onClick = { deleteOpen = false }) { Text("إلغاء") } })
}
