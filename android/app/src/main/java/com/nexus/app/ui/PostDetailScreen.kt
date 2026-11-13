package com.nexus.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nexus.app.data.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostDetailScreen(state: NexusUiState, onBack: () -> Unit, onComment: (String, Boolean, String?) -> Unit,
    onAccept: (String?) -> Unit, onDelete: (String) -> Unit) {
    var draft by rememberSaveable { mutableStateOf("") }
    var anonymous by rememberSaveable { mutableStateOf(false) }
    var replyTo by rememberSaveable { mutableStateOf<String?>(null) }
    val detail = state.postDetail
    val isSubAdmin = state.profile?.roles?.contains("sub_admin") == true
    val isAuthor = detail?.post?.authorId == state.profile?.id
    val isAdmin = state.profile?.roles?.contains("admin") == true
    Scaffold(topBar = { TopAppBar(title = { Text("المنشور والتعليقات") }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowForward, "رجوع") } }) },
        bottomBar = { Surface(tonalElevation = 2.dp) { Column(Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (replyTo != null) Row(verticalAlignment = Alignment.CenterVertically) { Text("الرد على تعليق", Modifier.weight(1f), style = MaterialTheme.typography.labelSmall); TextButton(onClick = { replyTo = null }) { Text("إلغاء الرد") } }
            OutlinedTextField(draft, { draft = it }, Modifier.fillMaxWidth(), enabled = !isSubAdmin, placeholder = { Text(if (isSubAdmin) "المشرف المساعد لا يملك صلاحية التعليق" else "اكتب تعليقاً أو رداً...") }, maxLines = 4)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(anonymous, { anonymous = it }, enabled = !isSubAdmin); Text("تعليق مجهول", style = MaterialTheme.typography.labelMedium)
                Spacer(Modifier.weight(1f)); Button(onClick = { onComment(draft, anonymous, replyTo); draft = ""; anonymous = false; replyTo = null }, enabled = draft.isNotBlank() && !isSubAdmin) { Icon(Icons.Outlined.Send, null); Spacer(Modifier.width(5.dp)); Text("إرسال") }
            }
        } } }) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (state.postDetailLoading && detail == null) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            if (detail != null) {
                item {
                    Card(shape = RoundedCornerShape(16.dp)) { Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) { Text(detail.post.authorName, Modifier.weight(1f), fontWeight = FontWeight.Bold); AssistChip(onClick = {}, label = { Text(if (detail.post.postType == "question") "سؤال" else "منشور") }) }
                        Text(detail.post.content, style = MaterialTheme.typography.bodyLarge)
                        detail.post.images.forEach { AsyncImage(it, "صورة المنشور", Modifier.fillMaxWidth().heightIn(max = 340.dp)) }
                        if (detail.post.postType == "question" && isAuthor && detail.post.acceptedAnswerId != null) TextButton(onClick = { onAccept(null) }) { Text("إلغاء اعتماد الإجابة") }
                        Text("${detail.comments.size} تعليق", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    } }
                }
                val roots = detail.comments.filter { it.parentId == null }
                if (roots.isEmpty()) item { Text("لا توجد تعليقات بعد.", Modifier.fillMaxWidth().padding(20.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                items(roots, key = { it.id }) { comment ->
                    CommentThreadItem(comment, detail.comments.filter { it.parentId == comment.id }, detail.post, state.profile, isAdmin,
                        onReply = { replyTo = it }, onAccept = onAccept, onDelete = onDelete)
                }
            }
        }
    }
}

@Composable
private fun CommentThreadItem(comment: FeedComment, replies: List<FeedComment>, post: FeedPost, profile: StudentProfile?, isAdmin: Boolean,
    onReply: (String) -> Unit, onAccept: (String?) -> Unit, onDelete: (String) -> Unit) {
    val accepted = post.acceptedAnswerId == comment.id
    Card(shape = RoundedCornerShape(13.dp), colors = CardDefaults.cardColors(containerColor = if (accepted) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.surfaceVariant)) {
        Column(Modifier.fillMaxWidth().padding(11.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) { Text(comment.authorName, Modifier.weight(1f), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold); if (accepted) Icon(Icons.Outlined.CheckCircle, "إجابة معتمدة", tint = MaterialTheme.colorScheme.tertiary) }
            Text(comment.content, style = MaterialTheme.typography.bodyMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = { onReply(comment.id) }) { Text("رد") }
                if (post.postType == "question" && profile?.id == post.authorId) TextButton(onClick = { onAccept(if (accepted) null else comment.id) }) { Text(if (accepted) "إلغاء الاعتماد" else "اعتماد الإجابة") }
                if (comment.authorId == profile?.id || isAdmin) TextButton(onClick = { onDelete(comment.id) }) { Text("حذف") }
            }
            replies.forEach { reply ->
                Row(Modifier.padding(start = 18.dp)) { Column(Modifier.weight(1f)) {
                    Text(reply.authorName, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                    Text(reply.content, style = MaterialTheme.typography.bodySmall)
                    Row { TextButton(onClick = { onReply(reply.id) }) { Text("رد") }; if (reply.authorId == profile?.id || isAdmin) TextButton(onClick = { onDelete(reply.id) }) { Text("حذف") } }
                } }
            }
        }
    }
}
