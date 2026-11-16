package com.nexus.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nexus.app.data.*
import com.nexus.app.ui.theme.nexus
import kotlinx.coroutines.delay

// =============================================================================
// Shared bits
// =============================================================================

@Composable
internal fun InitialsAvatar(name: String, url: String?, size: Int) {
    if (!url.isNullOrBlank()) {
        AsyncImage(model = url, contentDescription = name, modifier = Modifier.size(size.dp).clip(CircleShape), contentScale = ContentScale.Crop)
    } else {
        Box(Modifier.size(size.dp).clip(CircleShape).background(MaterialTheme.colorScheme.secondaryContainer), contentAlignment = Alignment.Center) {
            Text(name.take(1), color = MaterialTheme.colorScheme.onSecondaryContainer, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
internal fun NexusTopBar(title: String, onBack: (() -> Unit)? = null, actions: @Composable RowScope.() -> Unit = {}) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (onBack != null) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "رجوع") }
        }
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        actions()
    }
}

@Composable
internal fun NexusEmptyState(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String) {
    Column(Modifier.fillMaxSize().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(36.dp))
        Spacer(Modifier.height(8.dp))
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// =============================================================================
// Messages
// =============================================================================

@Composable
fun MessagesListScreen(
    state: NexusUiState,
    onOpen: (String, String?, String) -> Unit,
    onHome: () -> Unit,
    onCourses: () -> Unit,
    onProfile: () -> Unit
) {
    val ms = state.messaging
    Scaffold(
        bottomBar = { NexusBottomBar(AppScreen.MESSAGES, ms.unreadTotal, onHome, onCourses, {}, onProfile) },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            NexusTopBar("المحادثات")
            if (ms.loading && ms.conversations.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            } else if (ms.conversations.isEmpty()) {
                NexusEmptyState(Icons.Outlined.ChatBubbleOutline, "لا توجد محادثات بعد", "ابدأ محادثة من صفحة أحد الأعضاء")
            } else {
                LazyColumn(contentPadding = PaddingValues(vertical = 4.dp)) {
                    items(ms.conversations, key = { it.id }) { c ->
                        Row(
                            Modifier.fillMaxWidth().clickable { onOpen(c.id, c.otherUserId, c.title) }.padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            InitialsAvatar(c.title, c.avatarUrl, 48)
                            Column(Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text(c.title, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                                    if (c.blocked) Icon(Icons.Outlined.Block, contentDescription = "محظور", modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.error)
                                }
                                Text(c.lastMessage ?: "ابدأ المحادثة", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            if (c.unreadCount > 0) {
                                Badge(containerColor = MaterialTheme.colorScheme.primary) { Text(c.unreadCount.toString(), color = MaterialTheme.colorScheme.onPrimary) }
                            }
                        }
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    }
                }
            }
        }
    }
}

@Composable
fun ConversationScreen(state: NexusUiState, onBack: () -> Unit, onSend: (String) -> Unit, onBlock: (Boolean) -> Unit, onLeave: () -> Unit, onReport: (String, String?) -> Unit) {
    val ms = state.messaging
    var draft by rememberSaveable { mutableStateOf("") }
    var menuOpen by remember { mutableStateOf(false) }
    var reportOpen by remember { mutableStateOf(false) }
    var reportReason by remember { mutableStateOf("محتوى غير مناسب") }
    val myId = state.profile?.id

    Scaffold(
        topBar = {
            NexusTopBar(ms.activeTitle, onBack = onBack) {
                Box {
                    IconButton(onClick = { menuOpen = true }) { Icon(Icons.Outlined.MoreVert, contentDescription = "خيارات") }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(text = { Text("حظر المستخدم") }, onClick = { menuOpen = false; onBlock(true) })
                        DropdownMenuItem(text = { Text("إلغاء الحظر") }, onClick = { menuOpen = false; onBlock(false) })
                        DropdownMenuItem(text = { Text("إبلاغ") }, onClick = { menuOpen = false; reportOpen = true })
                        DropdownMenuItem(text = { Text("مغادرة المحادثة") }, onClick = { menuOpen = false; onLeave() })
                    }
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (ms.loading) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    contentPadding = PaddingValues(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(ms.messages, key = { it.id }) { m ->
                        val mine = m.senderId == myId
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.Start else Arrangement.End) {
                            Surface(
                                color = if (mine) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                                shape = RoundedCornerShape(14.dp)
                            ) {
                                Text(m.content, Modifier.padding(horizontal = 12.dp, vertical = 8.dp), color = if (mine) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Row(Modifier.fillMaxWidth().padding(10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = draft, onValueChange = { draft = it }, modifier = Modifier.weight(1f),
                    placeholder = { Text("اكتب رسالة...") }, shape = RoundedCornerShape(16.dp), maxLines = 4,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send)
                )
                IconButton(onClick = { if (draft.isNotBlank()) { onSend(draft.trim()); draft = "" } }, enabled = !ms.sending && draft.isNotBlank()) {
                    Icon(Icons.AutoMirrored.Outlined.Send, contentDescription = "إرسال", tint = MaterialTheme.colorScheme.primary)
                }
            }
        }
    }

    if (reportOpen) {
        AlertDialog(
            onDismissRequest = { reportOpen = false },
            title = { Text("الإبلاغ عن المستخدم") },
            text = {
                Column {
                    listOf("محتوى غير مناسب", "إساءة أو تنمر", "رسائل مزعجة", "سبب آخر").forEach { reason ->
                        Row(Modifier.fillMaxWidth().clickable { reportReason = reason }, verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = reportReason == reason, onClick = { reportReason = reason })
                            Text(reason)
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { onReport(reportReason, null); reportOpen = false }) { Text("إرسال البلاغ") } },
            dismissButton = { TextButton(onClick = { reportOpen = false }) { Text("إلغاء") } }
        )
    }
}

// =============================================================================
// Notifications
// =============================================================================

@Composable
fun NotificationsScreen(state: NexusUiState, onBack: () -> Unit, onOpen: (String) -> Unit, onMarkAllRead: () -> Unit) {
    val ns = state.notifications
    Scaffold(
        topBar = {
            NexusTopBar("الإشعارات", onBack = onBack) {
                TextButton(onClick = onMarkAllRead) { Text("تعليم الكل كمقروء") }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        if (ns.loading && ns.items.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else if (ns.items.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding)) { NexusEmptyState(Icons.Outlined.NotificationsNone, "لا توجد إشعارات", "ستظهر هنا تفاعلات زملائك") }
        } else {
            LazyColumn(Modifier.padding(padding)) {
                items(ns.items, key = { it.id }) { n ->
                    Row(
                        Modifier.fillMaxWidth().clickable { onOpen(n.id) }
                            .background(if (!n.read) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.25f) else MaterialTheme.colorScheme.background)
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        InitialsAvatar(n.actorName ?: "ن", n.actorAvatar, 40)
                        Column(Modifier.weight(1f)) {
                            Text(n.title, fontWeight = if (!n.read) FontWeight.Bold else FontWeight.Normal)
                            if (!n.body.isNullOrBlank()) Text(n.body, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                        if (n.priority == "urgent") {
                            Surface(color = MaterialTheme.colorScheme.errorContainer, shape = RoundedCornerShape(8.dp)) {
                                Text("عاجل", Modifier.padding(horizontal = 6.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onErrorContainer)
                            }
                        }
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                }
            }
        }
    }
}

// =============================================================================
// Search
// =============================================================================

@Composable
fun SearchScreen(state: NexusUiState, onQueryChange: (String) -> Unit, onBack: () -> Unit, onOpenProfile: (String, String) -> Unit) {
    val s = state.search
    Scaffold(topBar = { NexusTopBar("البحث", onBack = onBack) }, containerColor = MaterialTheme.colorScheme.background) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
            OutlinedTextField(
                value = s.query, onValueChange = onQueryChange, modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("ابحث عن أشخاص أو منشورات أو مقررات") },
                leadingIcon = { Icon(Icons.Outlined.Search, null) }, shape = RoundedCornerShape(14.dp), singleLine = true
            )
            Spacer(Modifier.height(10.dp))
            if (s.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
            if (s.query.isBlank() && s.recent.isNotEmpty()) {
                Text("عمليات بحث سابقة", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 8.dp)) {
                    items(s.recent) { q -> AssistChip(onClick = { onQueryChange(q) }, label = { Text(q) }) }
                }
            }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp), contentPadding = PaddingValues(vertical = 10.dp)) {
                if (s.results.people.isNotEmpty()) {
                    item { Text("أشخاص", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold) }
                    items(s.results.people, key = { "p-" + it.id }) { p ->
                        Row(Modifier.fillMaxWidth().clickable { onOpenProfile(p.id, p.fullName) }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            InitialsAvatar(p.fullName, p.avatarUrl, 40)
                            Text(p.fullName, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
                if (s.results.posts.isNotEmpty()) {
                    item { Text("منشورات", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold) }
                    items(s.results.posts, key = { "post-" + it.id }) { p ->
                        Surface(shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                            Text(p.content, Modifier.padding(12.dp), maxLines = 3, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
                if (s.results.courses.isNotEmpty()) {
                    item { Text("مقررات", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold) }
                    items(s.results.courses, key = { "c-" + it.id }) { c ->
                        Text(c.name, Modifier.padding(vertical = 6.dp), fontWeight = FontWeight.SemiBold)
                    }
                }
                if (!s.loading && s.query.length >= 2 && s.results.people.isEmpty() && s.results.posts.isEmpty() && s.results.courses.isEmpty()) {
                    item { Text("لا نتائج مطابقة", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
            }
        }
    }
}

// =============================================================================
// Leaderboard
// =============================================================================

@Composable
fun LeaderboardScreen(state: NexusUiState, onBack: () -> Unit, onFilter: (String?, Int?) -> Unit) {
    val lb = state.leaderboard
    Scaffold(topBar = { NexusTopBar("لوحة الصدارة", onBack = onBack) }, containerColor = MaterialTheme.colorScheme.background) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = lb.major == null, onClick = { onFilter(null, lb.year) }, label = { Text("كل التخصصات") })
                listOf("it" to "IT", "is" to "IS", "se" to "SE").forEach { (code, label) ->
                    FilterChip(selected = lb.major == code, onClick = { onFilter(code, lb.year) }, label = { Text(label) })
                }
            }
            if (lb.loading) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            } else {
                val top3 = lb.entries.take(3)
                val rest = lb.entries.drop(3)
                LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(bottom = 90.dp)) {
                    if (top3.isNotEmpty()) {
                        item {
                            Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.Bottom) {
                                top3.getOrNull(1)?.let { PodiumSpot(it, 110) }
                                top3.getOrNull(0)?.let { PodiumSpot(it, 140, crown = true) }
                                top3.getOrNull(2)?.let { PodiumSpot(it, 90) }
                            }
                        }
                    }
                    items(rest, key = { it.id }) { e -> LeaderboardRow(e) }
                }
                lb.myRank?.let { mine ->
                    Surface(shadowElevation = 6.dp, color = MaterialTheme.colorScheme.surface) { LeaderboardRow(mine, highlight = true) }
                }
            }
        }
    }
}

@Composable
private fun PodiumSpot(entry: LeaderboardEntry, height: Int, crown: Boolean = false) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        if (crown) Icon(Icons.Outlined.EmojiEvents, contentDescription = null, tint = MaterialTheme.nexus.gold, modifier = Modifier.size(22.dp))
        InitialsAvatar(entry.fullName, entry.avatarUrl, if (crown) 64 else 52)
        Spacer(Modifier.height(6.dp))
        Text(entry.fullName, style = MaterialTheme.typography.labelMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.widthIn(max = 84.dp), textAlign = TextAlign.Center)
        Text("${entry.points}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.nexus.gold, fontWeight = FontWeight.Bold)
        Box(Modifier.width(64.dp).height(height.dp).padding(top = 6.dp).background(MaterialTheme.nexus.goldContainer, RoundedCornerShape(topStart = 10.dp, topEnd = 10.dp)), contentAlignment = Alignment.TopCenter) {
            Text("#${entry.rank}", Modifier.padding(top = 6.dp), color = MaterialTheme.nexus.onGoldContainer, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun LeaderboardRow(entry: LeaderboardEntry, highlight: Boolean = false) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("#${entry.rank}", Modifier.width(30.dp), fontWeight = FontWeight.Bold, color = if (highlight) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
        InitialsAvatar(entry.fullName, entry.avatarUrl, 36)
        Column(Modifier.weight(1f)) {
            Text(entry.fullName, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (!entry.major.isNullOrBlank()) Text(majorLabel(entry.major), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text("${entry.points} نقطة", fontWeight = FontWeight.Bold, color = MaterialTheme.nexus.gold)
    }
}


// =============================================================================
// Mention-aware text field (shared by the post composer and comment input)
// =============================================================================

/**
 * A text field that watches for a trailing "@partial-name" token and offers matching
 * people below the field, Facebook-style. Only the token at the very end of the text is
 * considered live — this keeps the detection simple and predictable while typing.
 */
@Composable
internal fun MentionAwareField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    searchPeople: suspend (String) -> List<PublicProfile>,
    modifier: Modifier = Modifier,
    minLines: Int = 1,
    maxLines: Int = 3
) {
    var suggestions by remember { mutableStateOf<List<PublicProfile>>(emptyList()) }
    val mentionQuery = remember(value) {
        val at = value.lastIndexOf('@')
        if (at == -1) return@remember null
        val after = value.substring(at + 1)
        if (after.isEmpty() || after.any { it.isWhitespace() }) null else after
    }

    LaunchedEffect(mentionQuery) {
        if (mentionQuery != null && mentionQuery.isNotBlank()) {
            delay(250)
            suggestions = searchPeople(mentionQuery).take(5)
        } else {
            suggestions = emptyList()
        }
    }

    Column(modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text(placeholder) },
            minLines = minLines,
            maxLines = maxLines,
            shape = RoundedCornerShape(12.dp)
        )
        if (suggestions.isNotEmpty()) {
            Surface(
                Modifier.fillMaxWidth().padding(top = 4.dp),
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surfaceVariant
            ) {
                Column {
                    suggestions.forEach { person ->
                        Row(
                            Modifier.fillMaxWidth().clickable {
                                val at = value.lastIndexOf('@')
                                onValueChange(value.substring(0, at) + "@" + person.fullName.replace(" ", "_") + " ")
                                suggestions = emptyList()
                            }.padding(horizontal = 12.dp, vertical = 9.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            InitialsAvatar(person.fullName, person.avatarUrl, 28)
                            Text(person.fullName, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}

/** Renders body text with "@mention" tokens picked out in the primary color, Facebook-style. */
@Composable
internal fun MentionText(text: String, style: androidx.compose.ui.text.TextStyle, color: androidx.compose.ui.graphics.Color = androidx.compose.ui.graphics.Color.Unspecified, modifier: Modifier = Modifier) {
    val mentionColor = MaterialTheme.colorScheme.primary
    val annotated = remember(text, mentionColor) {
        androidx.compose.ui.text.buildAnnotatedString {
            val regex = Regex("@[\\p{L}0-9_]+")
            var last = 0
            for (match in regex.findAll(text)) {
                append(text.substring(last, match.range.first))
                withStyle(androidx.compose.ui.text.SpanStyle(color = mentionColor, fontWeight = FontWeight.SemiBold)) {
                    append(match.value.replace("_", " "))
                }
                last = match.range.last + 1
            }
            append(text.substring(last))
        }
    }
    Text(annotated, style = style, color = color, modifier = modifier)
}
