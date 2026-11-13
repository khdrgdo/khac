package com.nexus.app.ui

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nexus.app.data.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MessagesScreen(state: NexusUiState, onRefresh: () -> Unit, onSearch: (String) -> Unit,
    onStartChat: (String) -> Unit, onCreateGroup: (String, List<String>) -> Unit, onOpenChat: (String) -> Unit, onBack: () -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var groupMode by rememberSaveable { mutableStateOf(false) }
    var groupName by rememberSaveable { mutableStateOf("") }
    var selectedIds by remember { mutableStateOf(setOf<String>()) }
    Scaffold(topBar = { TopAppBar(title = { Text("المحادثات") }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowForward, "رجوع") } }, actions = {
        IconButton(onClick = { groupMode = !groupMode; selectedIds = emptySet() }) { Icon(if (groupMode) Icons.Outlined.Close else Icons.Outlined.GroupAdd, "إنشاء مجموعة") }
        IconButton(onClick = onRefresh) { Icon(Icons.Outlined.Refresh, "تحديث") }
    }) }) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (groupMode) item {
                OutlinedTextField(groupName, { groupName = it }, Modifier.fillMaxWidth(), singleLine = true, placeholder = { Text("اسم المجموعة") })
                Button(onClick = { onCreateGroup(groupName, selectedIds.toList()); groupMode = false; groupName = ""; selectedIds = emptySet() },
                    enabled = groupName.isNotBlank() && selectedIds.size >= 1, modifier = Modifier.fillMaxWidth()) { Text("إنشاء مجموعة (${selectedIds.size} أعضاء)") }
            }
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(query, { query = it }, Modifier.weight(1f), singleLine = true,
                        placeholder = { Text("ابحث عن زميل بالاسم أو الرقم") }, shape = RoundedCornerShape(13.dp))
                    IconButton(onClick = { onSearch(query) }, enabled = query.trim().length >= 2) { Icon(Icons.Outlined.Search, "بحث") }
                }
            }
            if (state.messageSearchResults.isNotEmpty()) {
                item { Text("نتائج البحث", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold) }
                items(state.messageSearchResults, key = { "user-" + it.id }) { user ->
                    Card(onClick = { if (groupMode) selectedIds = if (user.id in selectedIds) selectedIds - user.id else selectedIds + user.id else onStartChat(user.id) }, shape = RoundedCornerShape(14.dp)) {
                        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Surface(shape = CircleShape, color = MaterialTheme.colorScheme.secondaryContainer, modifier = Modifier.size(40.dp)) { Box(contentAlignment = Alignment.Center) { Text(user.fullName.take(1)) } }
                            Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { Text(user.fullName, fontWeight = FontWeight.SemiBold); Text(user.universityNumber, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                            if (groupMode) Checkbox(user.id in selectedIds, { selectedIds = if (it) selectedIds + user.id else selectedIds - user.id })
                            else Icon(Icons.Outlined.Chat, null, tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }
            item { Text("محادثاتك", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold) }
            if (state.messagesLoading && state.conversations.isEmpty()) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            if (!state.messagesLoading && state.conversations.isEmpty()) item { Text("لا توجد محادثات بعد. ابحث عن زميل لبدء محادثة.", Modifier.fillMaxWidth().padding(20.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(state.conversations, key = { it.id }) { c ->
                Card(onClick = { onOpenChat(c.id) }, shape = RoundedCornerShape(14.dp)) {
                    Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                        Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primaryContainer, modifier = Modifier.size(42.dp)) { Box(contentAlignment = Alignment.Center) { Icon(if (c.isGroup) Icons.Outlined.Groups else Icons.Outlined.Person, null) } }
                        Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) {
                            Text(c.title, fontWeight = FontWeight.SemiBold)
                            Text(c.lastMessage.ifBlank { if (c.isGroup) "مجموعة" else "ابدأ المحادثة" }, maxLines = 1, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Icon(Icons.Outlined.ChevronLeft, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(state: NexusUiState, onBack: () -> Unit, onRefresh: () -> Unit, onSend: (String) -> Unit,
    onBlock: (String) -> Unit, onReport: (String, String, String?) -> Unit) {
    var draft by rememberSaveable { mutableStateOf("") }
    val active = state.conversations.firstOrNull { it.id == state.activeConversationId }
    val otherId = active?.otherUserId
    Scaffold(topBar = { TopAppBar(title = { Column { Text(active?.title ?: "المحادثة"); Text(if (active?.isGroup == true) "مجموعة" else "محادثة خاصة", style = MaterialTheme.typography.labelSmall) } },
        navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowForward, "رجوع") } },
        actions = { if (!active?.isGroup.orFalse() && otherId != null) {
            IconButton(onClick = { onBlock(otherId) }) { Icon(Icons.Outlined.Block, "حظر") }
            IconButton(onClick = { onReport(otherId, "محتوى غير لائق أو مسيء", null) }) { Icon(Icons.Outlined.Flag, "إبلاغ") }
        }; IconButton(onClick = onRefresh) { Icon(Icons.Outlined.Refresh, "تحديث") } }) },
        bottomBar = { Surface(tonalElevation = 2.dp) { Row(Modifier.fillMaxWidth().padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(draft, { draft = it }, Modifier.weight(1f), placeholder = { Text("اكتب رسالة...") }, maxLines = 4, shape = RoundedCornerShape(18.dp))
            Spacer(Modifier.width(8.dp)); IconButton(onClick = { onSend(draft); draft = "" }, enabled = draft.isNotBlank()) { Icon(Icons.Outlined.Send, "إرسال", tint = MaterialTheme.colorScheme.primary) }
        } } }) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (state.messages.isEmpty()) item { Text("ابدأ المحادثة برسالة جديدة", Modifier.fillMaxWidth().padding(24.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(state.messages, key = { it.id }) { msg ->
                val mine = msg.senderId == state.profile?.id
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start) {
                    Surface(shape = RoundedCornerShape(16.dp), color = if (mine) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                        modifier = Modifier.widthIn(max = 320.dp)) {
                        Column(Modifier.padding(horizontal = 12.dp, vertical = 9.dp)) {
                            Text(msg.content, style = MaterialTheme.typography.bodyLarge)
                            Text(msg.createdAt.take(16).replace('T',' '), Modifier.align(Alignment.End), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}

private fun Boolean?.orFalse(): Boolean = this ?: false
