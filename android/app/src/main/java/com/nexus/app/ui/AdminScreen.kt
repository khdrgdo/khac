package com.nexus.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nexus.app.data.*
import com.nexus.app.ui.theme.nexus

/**
 * Admin console: overview stats, user management, a shared report queue (posts + messages),
 * banned words, and a recent-activity feed. Every mutation calls a server-side RPC
 * (admin_* functions already enforced by Supabase policies) — this screen never decides
 * who is allowed to do what, it only reflects [NexusUiState.role].
 */
@Composable
fun AdminScreen(
    state: NexusUiState,
    onBack: () -> Unit,
    onTab: (AdminTab) -> Unit,
    onSetRole: (String, String) -> Unit,
    onBan: (String, String) -> Unit,
    onUnban: (String) -> Unit,
    onSuspend: (String, Int, String) -> Unit,
    onWarn: (String, String) -> Unit,
    onSetVerified: (String, Boolean) -> Unit,
    onAdjustPoints: (String, Int) -> Unit,
    onDeleteUser: (String) -> Unit,
    onSetTeacher: (String) -> Unit,
    onDismissPostReport: (String) -> Unit,
    onDismissMessageReport: (String) -> Unit,
    onDeletePost: (String, String) -> Unit,
    onAddBannedWord: (String) -> Unit,
    onRemoveBannedWord: (String) -> Unit
) {
    val admin = state.admin
    Scaffold(topBar = { NexusTopBar("لوحة الإدارة", onBack = onBack) }, containerColor = MaterialTheme.colorScheme.background) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            LazyRow(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(AdminTab.entries) { tab ->
                    FilterChip(selected = admin.tab == tab, onClick = { onTab(tab) }, label = { Text(tab.label) })
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            if (admin.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
            when (admin.tab) {
                AdminTab.OVERVIEW -> AdminOverviewTab(admin.stats)
                AdminTab.USERS -> AdminUsersTab(admin.users, onSetRole, onBan, onUnban, onSuspend, onWarn, onSetVerified, onAdjustPoints, onDeleteUser, onSetTeacher)
                AdminTab.REPORTS -> AdminReportsTab(admin.postReports, admin.messageReports, onDismissPostReport, onDismissMessageReport, onDeletePost)
                AdminTab.WORDS -> AdminWordsTab(admin.bannedWords, onAddBannedWord, onRemoveBannedWord)
                AdminTab.ACTIVITY -> AdminActivityTab(admin.activity)
            }
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(modifier, shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
        Column(Modifier.padding(14.dp)) {
            Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun AdminOverviewTab(stats: AdminStats) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("المستخدمون", stats.totalUsers.toString(), Modifier.weight(1f))
                StatCard("المنشورات", stats.totalPosts.toString(), Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("المقررات", stats.totalCourses.toString(), Modifier.weight(1f))
                StatCard("بلاغات معلّقة", stats.pendingReports.toString(), Modifier.weight(1f))
            }
        }
        if (stats.dailyPosts.isNotEmpty()) {
            item { Text("منشورات آخر 14 يومًا", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold) }
            items(stats.dailyPosts) { (day, count) ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(day, style = MaterialTheme.typography.bodySmall)
                    Text(count.toString(), fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun AdminUsersTab(
    users: List<AdminUserRow>,
    onSetRole: (String, String) -> Unit,
    onBan: (String, String) -> Unit,
    onUnban: (String) -> Unit,
    onSuspend: (String, Int, String) -> Unit,
    onWarn: (String, String) -> Unit,
    onSetVerified: (String, Boolean) -> Unit,
    onAdjustPoints: (String, Int) -> Unit,
    onDeleteUser: (String) -> Unit,
    onSetTeacher: (String) -> Unit
) {
    var query by rememberSaveable { mutableStateOf("") }
    var expandedId by remember { mutableStateOf<String?>(null) }
    val filtered = remember(users, query) {
        if (query.isBlank()) users else users.filter { it.fullName.contains(query, true) || it.universityNumber.contains(query, true) }
    }
    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = query, onValueChange = { query = it }, modifier = Modifier.fillMaxWidth().padding(16.dp),
            placeholder = { Text("ابحث بالاسم أو الرقم الجامعي") }, leadingIcon = { Icon(Icons.Outlined.Search, null) }, singleLine = true
        )
        LazyColumn(contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)) {
            items(filtered, key = { it.id }) { user ->
                Surface(
                    Modifier.fillMaxWidth().padding(vertical = 4.dp).clickable { expandedId = if (expandedId == user.id) null else user.id },
                    shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            InitialsAvatar(user.fullName, user.avatarUrl, 40)
                            Column(Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text(user.fullName, fontWeight = FontWeight.Bold)
                                    if (user.verified) Icon(Icons.Outlined.Verified, null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.primary)
                                    if (user.banned) AssistChip(onClick = {}, label = { Text("محظور", style = MaterialTheme.typography.labelSmall) })
                                }
                                Text("${user.universityNumber} · ${user.role} · ${user.points} نقطة", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Icon(if (expandedId == user.id) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore, null)
                        }
                        if (expandedId == user.id) {
                            AdminUserActions(user, onSetRole, onBan, onUnban, onSuspend, onWarn, onSetVerified, onAdjustPoints, onDeleteUser, onSetTeacher)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AdminUserActions(
    user: AdminUserRow,
    onSetRole: (String, String) -> Unit,
    onBan: (String, String) -> Unit,
    onUnban: (String) -> Unit,
    onSuspend: (String, Int, String) -> Unit,
    onWarn: (String, String) -> Unit,
    onSetVerified: (String, Boolean) -> Unit,
    onAdjustPoints: (String, Int) -> Unit,
    onDeleteUser: (String) -> Unit,
    onSetTeacher: (String) -> Unit
) {
    var confirmDelete by remember { mutableStateOf(false) }
    FlowActions {
        AssistChip(onClick = { onSetVerified(user.id, !user.verified) }, label = { Text(if (user.verified) "إلغاء التوثيق" else "توثيق") })
        AssistChip(onClick = { onAdjustPoints(user.id, 10) }, label = { Text("+10 نقاط") })
        AssistChip(onClick = { onAdjustPoints(user.id, -10) }, label = { Text("-10 نقاط") })
        AssistChip(onClick = { onWarn(user.id, "مخالفة قوانين المجتمع") }, label = { Text("تحذير") })
        if (user.banned) {
            AssistChip(onClick = { onUnban(user.id) }, label = { Text("فك الحظر") })
        } else {
            AssistChip(onClick = { onBan(user.id, "مخالفة متكررة") }, label = { Text("حظر") })
        }
        AssistChip(onClick = { onSuspend(user.id, 7, "إيقاف مؤقت") }, label = { Text("إيقاف 7 أيام") })
        if (user.role != "teacher") AssistChip(onClick = { onSetTeacher(user.id) }, label = { Text("تعيين كمعلّم") })
        if (user.role != "sub_admin") AssistChip(onClick = { onSetRole(user.id, "sub_admin") }, label = { Text("تعيين كمشرف مساعد") })
        AssistChip(onClick = { confirmDelete = true }, label = { Text("حذف الحساب", color = MaterialTheme.colorScheme.error) })
    }
    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("حذف الحساب نهائيًا") },
            text = { Text("هذا الإجراء لا يمكن التراجع عنه. هل تريد المتابعة؟") },
            confirmButton = { TextButton(onClick = { onDeleteUser(user.id); confirmDelete = false }) { Text("حذف", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("إلغاء") } }
        )
    }
}

@Composable
private fun FlowActions(content: @Composable () -> Unit) {
    // FlowRow isn't in the stable foundation layout set we depend on; a horizontally scrolling row keeps this simple and safe.
    LazyRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        item { Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { content() } }
    }
}

@Composable
private fun AdminReportsTab(
    postReports: List<PostReport>,
    messageReports: List<MessageReport>,
    onDismissPostReport: (String) -> Unit,
    onDismissMessageReport: (String) -> Unit,
    onDeletePost: (String, String) -> Unit
) {
    if (postReports.isEmpty() && messageReports.isEmpty()) {
        NexusEmptyState(Icons.Outlined.ReportGmailerrorred, "لا توجد بلاغات معلّقة", "ستظهر هنا بلاغات المنشورات والرسائل")
        return
    }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (postReports.isNotEmpty()) {
            item { Text("بلاغات المنشورات", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold) }
            items(postReports, key = { "pr-" + it.id }) { r ->
                Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
                    Column(Modifier.padding(12.dp)) {
                        Text(r.postContent ?: "منشور محذوف", maxLines = 3, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium)
                        Text("السبب: ${r.reason} · ${r.reporterName ?: "مستخدم"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(onClick = { onDismissPostReport(r.id) }) { Text("تجاهل") }
                            TextButton(onClick = { onDeletePost(r.postId, r.id) }) { Text("حذف المنشور", color = MaterialTheme.colorScheme.error) }
                        }
                    }
                }
            }
        }
        if (messageReports.isNotEmpty()) {
            item { Text("بلاغات الرسائل", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold) }
            items(messageReports, key = { "mr-" + it.id }) { r ->
                Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
                    Column(Modifier.padding(12.dp)) {
                        Text("بلاغ على ${r.reportedUserName ?: "مستخدم"}", fontWeight = FontWeight.SemiBold)
                        Text("السبب: ${r.reason} · بواسطة ${r.reporterName ?: "مستخدم"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (!r.note.isNullOrBlank()) Text(r.note, style = MaterialTheme.typography.bodySmall)
                        TextButton(onClick = { onDismissMessageReport(r.id) }, modifier = Modifier.padding(top = 4.dp)) { Text("تجاهل") }
                    }
                }
            }
        }
    }
}

@Composable
private fun AdminWordsTab(words: List<BannedWord>, onAdd: (String) -> Unit, onRemove: (String) -> Unit) {
    var newWord by rememberSaveable { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(value = newWord, onValueChange = { newWord = it }, modifier = Modifier.weight(1f), placeholder = { Text("كلمة جديدة") }, singleLine = true)
            IconButton(onClick = { if (newWord.isNotBlank()) { onAdd(newWord.trim()); newWord = "" } }) { Icon(Icons.Outlined.Add, contentDescription = "إضافة") }
        }
        LazyColumn(Modifier.padding(top = 10.dp)) {
            items(words, key = { it.id }) { w ->
                Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(w.word)
                    IconButton(onClick = { onRemove(w.id) }) { Icon(Icons.Outlined.Delete, contentDescription = "حذف", tint = MaterialTheme.colorScheme.error) }
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
        }
    }
}

@Composable
private fun AdminActivityTab(activity: List<AdminActivityItem>) {
    if (activity.isEmpty()) {
        NexusEmptyState(Icons.Outlined.History, "لا يوجد نشاط إداري مسجّل", "ستظهر هنا إجراءات فريق الإدارة")
        return
    }
    LazyColumn(contentPadding = PaddingValues(16.dp)) {
        items(activity, key = { it.id }) { a ->
            Column(Modifier.padding(vertical = 8.dp)) {
                Text(a.description, fontWeight = FontWeight.SemiBold)
                Text("${a.userName ?: ""} · ${a.createdAt}".trim(' ', '·'), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        }
    }
}
