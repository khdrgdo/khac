package com.nexus.app.ui

import android.content.Intent
import android.net.Uri
import android.text.format.DateUtils
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.nexus.app.BuildConfig
import com.nexus.app.data.*
import java.time.Instant

private val feedReactionOptions = listOf(
    Triple("like", "👍", "إعجاب"),
    Triple("love", "❤️", "أحببته"),
    Triple("haha", "😂", "مضحك"),
    Triple("wow", "😮", "مذهل"),
    Triple("sad", "😢", "حزين")
)

@Composable
fun SocialFeedScreen(
    state: NexusUiState,
    onRefresh: (String, String?) -> Unit,
    onPublish: (String, Boolean, Boolean, List<Uri>) -> Unit,
    onComment: (String, String) -> Unit,
    onReact: (String, String?) -> Unit,
    onSave: (String, Boolean) -> Unit,
    onDelete: (String) -> Unit,
    onReport: (String, String) -> Unit,
    onResolveImage: (String, (String?) -> Unit) -> Unit,
    onHome: () -> Unit,
    onCourses: () -> Unit,
    onProfile: () -> Unit
) {
    var draft by rememberSaveable { mutableStateOf("") }
    var anonymous by rememberSaveable { mutableStateOf(false) }
    var question by rememberSaveable { mutableStateOf(false) }
    var filter by rememberSaveable { mutableStateOf(state.feedFilter) }
    var activeTag by rememberSaveable { mutableStateOf(state.feedTag) }
    var selectedImages by remember { mutableStateOf<List<Uri>>(emptyList()) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        selectedImages = uris.take(4)
    }

    LaunchedEffect(state.feedFilter, state.feedTag) {
        filter = state.feedFilter
        activeTag = state.feedTag
    }
    LaunchedEffect(state.notice) {
        if (state.notice == "تم نشر مساهمتك") {
            draft = ""
            anonymous = false
            question = false
            selectedImages = emptyList()
        }
    }

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                NavigationBarItem(selected = true, onClick = onHome, icon = { Icon(Icons.Outlined.Home, null) }, label = { Text("الرئيسية") })
                NavigationBarItem(selected = false, onClick = onCourses, icon = { Icon(Icons.Outlined.MenuBook, null) }, label = { Text("المقررات") })
                NavigationBarItem(selected = false, onClick = onProfile, icon = { Icon(Icons.Outlined.PersonOutline, null) }, label = { Text("حسابي") })
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("المجتمع", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                        Text("مساحة لتبادل المعرفة والنقاش", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    IconButton(onClick = { onRefresh(filter, activeTag) }, enabled = !state.loading) {
                        Icon(Icons.Outlined.Refresh, contentDescription = "تحديث المنشورات")
                    }
                }
            }

            if (!state.error.isNullOrBlank()) {
                item {
                    Surface(color = MaterialTheme.colorScheme.errorContainer, shape = RoundedCornerShape(12.dp)) {
                        Text(state.error, Modifier.fillMaxWidth().padding(12.dp), color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            if (!state.notice.isNullOrBlank()) {
                item {
                    Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = RoundedCornerShape(12.dp)) {
                        Text(state.notice, Modifier.fillMaxWidth().padding(12.dp), color = MaterialTheme.colorScheme.onSecondaryContainer, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    FilterChip(selected = filter == "all", onClick = { filter = "all"; onRefresh(filter, activeTag) }, label = { Text("الكل") })
                    FilterChip(selected = filter == "open_questions", onClick = { filter = "open_questions"; onRefresh(filter, activeTag) }, label = { Text("أسئلة مفتوحة") })
                    FilterChip(selected = filter == "solved_questions", onClick = { filter = "solved_questions"; onRefresh(filter, activeTag) }, label = { Text("تم حلها") })
                }
            }

            if (!activeTag.isNullOrBlank()) {
                item {
                    Surface(color = MaterialTheme.colorScheme.tertiaryContainer, shape = RoundedCornerShape(10.dp)) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("الوسم: #$activeTag", modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.onTertiaryContainer, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
                            TextButton(onClick = { activeTag = null; onRefresh(filter, null) }, contentPadding = PaddingValues(horizontal = 8.dp)) {
                                Text("إزالة")
                            }
                        }
                    }
                }
            }

            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            ProfileAvatar(state.profile?.avatarUrl, state.profile?.fullName ?: "طالب", 40)
                            Column {
                                Text("ابدأ منشوراً", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                Text("شارك فكرة أو اطرح سؤالاً", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                        OutlinedTextField(
                            value = draft,
                            onValueChange = { draft = it },
                            modifier = Modifier.fillMaxWidth(),
                            placeholder = { Text(if (question) "اكتب سؤالك بالتفصيل..." else "ما الذي تود مشاركته مع زملائك؟") },
                            minLines = 3,
                            maxLines = 6,
                            shape = RoundedCornerShape(12.dp)
                        )
                        Text(
                            "استخدم #وسم لتصنيف المنشور، أو @ للإشارة إلى زميل.",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        if (selectedImages.isNotEmpty()) {
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                items(selectedImages) { uri ->
                                    Box {
                                        AsyncImage(
                                            model = uri,
                                            contentDescription = "صورة مرفقة",
                                            modifier = Modifier.size(width = 116.dp, height = 88.dp).clip(RoundedCornerShape(10.dp)),
                                            contentScale = ContentScale.Crop
                                        )
                                        IconButton(
                                            onClick = { selectedImages = selectedImages.filterNot { it == uri } },
                                            modifier = Modifier.align(Alignment.TopEnd).size(30.dp).background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.55f), CircleShape)
                                        ) {
                                            Icon(Icons.Outlined.Close, contentDescription = "إزالة الصورة", tint = MaterialTheme.colorScheme.surface, modifier = Modifier.size(16.dp))
                                        }
                                    }
                                }
                            }
                        }

                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(
                                selected = question,
                                onClick = { question = !question },
                                label = { Text("سؤال") },
                                leadingIcon = { Icon(Icons.Outlined.HelpOutline, null, Modifier.size(16.dp)) }
                            )
                            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.End) {
                                Text("نشر دون اسم", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Checkbox(checked = anonymous, onCheckedChange = { anonymous = it })
                            }
                        }
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = { picker.launch("image/*") },
                                enabled = !state.busy && selectedImages.size < 4,
                                shape = RoundedCornerShape(11.dp),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 9.dp)
                            ) {
                                Icon(Icons.Outlined.AddPhotoAlternate, null, Modifier.size(17.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("صور ${selectedImages.size}/4", style = MaterialTheme.typography.labelMedium)
                            }
                            Spacer(Modifier.weight(1f))
                            Button(
                                onClick = { onPublish(draft, anonymous, question, selectedImages) },
                                enabled = !state.busy && draft.isNotBlank(),
                                shape = RoundedCornerShape(11.dp),
                                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 10.dp)
                            ) {
                                if (state.busy) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                                else {
                                    Icon(Icons.Outlined.Send, null, Modifier.size(16.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text("نشر")
                                }
                            }
                        }
                    }
                }
            }

            if (state.loading && state.feedPosts.isEmpty()) {
                items(3) {
                    Card(shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Box(Modifier.fillMaxWidth(0.45f).height(14.dp).clip(RoundedCornerShape(6.dp)).background(MaterialTheme.colorScheme.surfaceVariant))
                            Box(Modifier.fillMaxWidth().height(12.dp).clip(RoundedCornerShape(6.dp)).background(MaterialTheme.colorScheme.surfaceVariant))
                            Box(Modifier.fillMaxWidth(0.8f).height(12.dp).clip(RoundedCornerShape(6.dp)).background(MaterialTheme.colorScheme.surfaceVariant))
                            Box(Modifier.fillMaxWidth().height(90.dp).clip(RoundedCornerShape(10.dp)).background(MaterialTheme.colorScheme.surfaceVariant))
                        }
                    }
                }
            } else if (state.feedPosts.isEmpty()) {
                item {
                    Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                        Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Outlined.Forum, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(30.dp))
                            Text("لا توجد منشورات هنا بعد", style = MaterialTheme.typography.titleMedium)
                            Text("كن أول من يبدأ النقاش.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            } else {
                items(state.feedPosts, key = { it.id }) { post ->
                    FeedPostCard(
                        post = post,
                        currentUserId = state.profile?.id,
                        onTagClick = { tag -> activeTag = tag; onRefresh(filter, tag) },
                        onComment = onComment,
                        onReact = onReact,
                        onSave = onSave,
                        onDelete = onDelete,
                        onReport = onReport,
                        onResolveImage = onResolveImage
                    )
                }
            }
        }
    }
}

@Composable
private fun FeedPostCard(
    post: FeedPost,
    currentUserId: String?,
    onTagClick: (String) -> Unit,
    onComment: (String, String) -> Unit,
    onReact: (String, String?) -> Unit,
    onSave: (String, Boolean) -> Unit,
    onDelete: (String) -> Unit,
    onReport: (String, String) -> Unit,
    onResolveImage: (String, (String?) -> Unit) -> Unit
) {
    val context = LocalContext.current
    var expanded by rememberSaveable(post.id) { mutableStateOf(false) }
    var commentOpen by rememberSaveable(post.id) { mutableStateOf(false) }
    var commentDraft by rememberSaveable(post.id) { mutableStateOf("") }
    var moreOpen by remember { mutableStateOf(false) }
    var reactionsOpen by remember { mutableStateOf(false) }
    var reportOpen by rememberSaveable(post.id) { mutableStateOf(false) }
    var deleteOpen by rememberSaveable(post.id) { mutableStateOf(false) }
    var reportReason by rememberSaveable(post.id) { mutableStateOf("محتوى غير مناسب") }
    val isMine = currentUserId != null && currentUserId == post.authorId
    val reactionCounts = post.reactions.groupingBy { it.reaction }.eachCount()
    val totalReactions = post.reactions.size
    val selectedReaction = feedReactionOptions.firstOrNull { it.first == post.myReaction }
    val tags = remember(post.content) {
        Regex("""(?:^|\s)#([\p{L}\p{N}_-]{2,40})""")
            .findAll(post.content)
            .map { it.groupValues[1] }
            .distinct()
            .take(8)
            .toList()
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ProfileAvatar(post.avatarUrl, post.authorName, 42)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(post.authorName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (post.authorVerified) Icon(Icons.Outlined.Verified, contentDescription = "حساب موثق", tint = MaterialTheme.colorScheme.tertiary, modifier = Modifier.size(15.dp))
                        if (post.anonymous) Text("مجهول", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text(
                        listOfNotNull(post.authorMajor?.takeIf { it.isNotBlank() }, relativePostTime(post.createdAt), if (post.authorPoints > 0) "${post.authorPoints} نقطة" else null).joinToString(" · "),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                if (post.postType == "question") {
                    Surface(color = if (post.acceptedAnswerId != null) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.secondaryContainer, shape = RoundedCornerShape(8.dp)) {
                        Text(if (post.acceptedAnswerId != null) "تم الحل" else "سؤال", modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp), style = MaterialTheme.typography.labelSmall, color = if (post.acceptedAnswerId != null) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onSecondaryContainer)
                    }
                }
                Box {
                    IconButton(onClick = { moreOpen = true }) { Icon(Icons.Outlined.MoreVert, contentDescription = "خيارات المنشور") }
                    DropdownMenu(expanded = moreOpen, onDismissRequest = { moreOpen = false }) {
                        if (isMine) {
                            DropdownMenuItem(text = { Text("حذف المنشور") }, leadingIcon = { Icon(Icons.Outlined.DeleteOutline, null) }, onClick = { moreOpen = false; deleteOpen = true })
                        } else {
                            DropdownMenuItem(text = { Text("إبلاغ") }, leadingIcon = { Icon(Icons.Outlined.Flag, null) }, onClick = { moreOpen = false; reportOpen = true })
                        }
                    }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    post.content,
                    style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 25.sp),
                    maxLines = if (expanded) Int.MAX_VALUE else 5,
                    overflow = TextOverflow.Ellipsis
                )
                if (post.content.length > 260) {
                    TextButton(onClick = { expanded = !expanded }, contentPadding = PaddingValues(horizontal = 0.dp, vertical = 0.dp)) {
                        Text(if (expanded) "عرض أقل" else "عرض المزيد", color = MaterialTheme.colorScheme.tertiary, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            if (tags.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                    tags.forEach { tag ->
                        AssistChip(
                            onClick = { onTagClick(tag) },
                            label = { Text("#$tag", style = MaterialTheme.typography.labelSmall) },
                            shape = RoundedCornerShape(9.dp),
                            colors = AssistChipDefaults.assistChipColors(labelColor = MaterialTheme.colorScheme.tertiary)
                        )
                    }
                }
            }

            if (post.images.isNotEmpty()) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(post.images) { path ->
                        PostImage(path, onResolveImage)
                    }
                }
            }

            if (totalReactions > 0 || post.commentsCount > 0) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        feedReactionOptions.filter { reactionCounts.containsKey(it.first) }.take(3).joinToString(" ") { it.second } +
                            if (totalReactions > 0) "  $totalReactions" else "",
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (post.commentsCount > 0) Text("${post.commentsCount} تعليق", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Box {
                    TextButton(onClick = { reactionsOpen = true }, contentPadding = PaddingValues(horizontal = 5.dp)) {
                        Text(selectedReaction?.second ?: "👍", fontSize = 17.sp)
                        Spacer(Modifier.width(4.dp))
                        Text(selectedReaction?.third ?: "إعجاب", style = MaterialTheme.typography.labelMedium)
                    }
                    DropdownMenu(expanded = reactionsOpen, onDismissRequest = { reactionsOpen = false }) {
                        feedReactionOptions.forEach { option ->
                            DropdownMenuItem(
                                text = { Text("${option.second}  ${option.third}") },
                                onClick = {
                                    onReact(post.id, if (post.myReaction == option.first) null else option.first)
                                    reactionsOpen = false
                                }
                            )
                        }
                    }
                }
                TextButton(onClick = { commentOpen = !commentOpen }, contentPadding = PaddingValues(horizontal = 5.dp)) {
                    Icon(Icons.Outlined.ChatBubbleOutline, null, Modifier.size(17.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("تعليق", style = MaterialTheme.typography.labelMedium)
                }
                TextButton(
                    onClick = {
                        val text = post.content + "\n\n" + BuildConfig.WEB_AUTH_URL.trimEnd('/') + "/posts/" + post.id
                        runCatching {
                            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "مشاركة المنشور"))
                        }
                    },
                    contentPadding = PaddingValues(horizontal = 5.dp)
                ) {
                    Icon(Icons.Outlined.Share, null, Modifier.size(17.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("مشاركة", style = MaterialTheme.typography.labelMedium)
                }
                IconButton(onClick = { onSave(post.id, !post.saved) }) {
                    Icon(if (post.saved) Icons.Outlined.Bookmark else Icons.Outlined.BookmarkBorder, contentDescription = if (post.saved) "إزالة من المحفوظات" else "حفظ المنشور", tint = if (post.saved) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            if (commentOpen) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = commentDraft,
                        onValueChange = { commentDraft = it },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("اكتب تعليقاً...") },
                        maxLines = 3,
                        shape = RoundedCornerShape(12.dp)
                    )
                    IconButton(
                        onClick = {
                            if (commentDraft.isNotBlank()) {
                                onComment(post.id, commentDraft.trim())
                                commentDraft = ""
                                commentOpen = false
                            }
                        },
                        enabled = commentDraft.isNotBlank()
                    ) { Icon(Icons.Outlined.Send, contentDescription = "إرسال التعليق", tint = MaterialTheme.colorScheme.primary) }
                }
            }
        }
    }

    if (reportOpen) {
        AlertDialog(
            onDismissRequest = { reportOpen = false },
            title = { Text("الإبلاغ عن المنشور") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    listOf("محتوى غير مناسب", "إساءة أو تنمر", "معلومات مضللة", "رسائل مزعجة", "سبب آخر").forEach { reason ->
                        Row(Modifier.fillMaxWidth().clickable { reportReason = reason }, verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = reportReason == reason, onClick = { reportReason = reason })
                            Text(reason, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { onReport(post.id, reportReason); reportOpen = false }) { Text("إرسال البلاغ") }
            },
            dismissButton = { TextButton(onClick = { reportOpen = false }) { Text("إلغاء") } }
        )
    }

    if (deleteOpen) {
        AlertDialog(
            onDismissRequest = { deleteOpen = false },
            title = { Text("حذف المنشور؟") },
            text = { Text("لن تتمكن من استعادة المنشور بعد حذفه.") },
            confirmButton = { TextButton(onClick = { onDelete(post.id); deleteOpen = false }) { Text("حذف", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { deleteOpen = false }) { Text("إلغاء") } }
        )
    }
}

@Composable
private fun PostImage(path: String, onResolveImage: (String, (String?) -> Unit) -> Unit) {
    var url by remember(path) { mutableStateOf(if (path.startsWith("http")) path else null) }
    LaunchedEffect(path) {
        if (url == null) onResolveImage(path) { resolved -> url = resolved }
    }
    if (url == null) {
        Box(
            Modifier.size(width = 250.dp, height = 180.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
        }
    } else {
        AsyncImage(
            model = url,
            contentDescription = "صورة في المنشور",
            modifier = Modifier.size(width = 250.dp, height = 180.dp).clip(RoundedCornerShape(12.dp)),
            contentScale = ContentScale.Crop
        )
    }
}

@Composable
private fun ProfileAvatar(url: String?, name: String, size: Int) {
    if (!url.isNullOrBlank()) {
        AsyncImage(model = url, contentDescription = name, modifier = Modifier.size(size.dp).clip(CircleShape), contentScale = ContentScale.Crop)
    } else {
        Box(Modifier.size(size.dp).clip(CircleShape).background(MaterialTheme.colorScheme.secondaryContainer), contentAlignment = Alignment.Center) {
            Text(name.take(1), color = MaterialTheme.colorScheme.onSecondaryContainer, fontWeight = FontWeight.Bold)
        }
    }
}

private fun relativePostTime(value: String): String {
    val millis = runCatching { Instant.parse(value).toEpochMilli() }.getOrNull() ?: return ""
    return DateUtils.getRelativeTimeSpanString(millis, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS).toString()
}
