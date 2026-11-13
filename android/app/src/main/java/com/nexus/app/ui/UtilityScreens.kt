package com.nexus.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nexus.app.data.*

@Composable
fun SavedPostsScreen(state: NexusUiState, onRefresh: () -> Unit, onUnsave: (String, Boolean) -> Unit,
    onHome: () -> Unit, onCourses: () -> Unit, onLeaderboard: () -> Unit, onProfile: () -> Unit) {
    Scaffold(bottomBar = { NavigationBar {
        NavigationBarItem(false, onHome, icon = { Icon(Icons.Outlined.Home, null) }, label = { Text("الرئيسية") })
        NavigationBarItem(false, onCourses, icon = { Icon(Icons.Outlined.MenuBook, null) }, label = { Text("المقررات") })
        NavigationBarItem(false, onLeaderboard, icon = { Icon(Icons.Outlined.EmojiEvents, null) }, label = { Text("الصدارة") })
        NavigationBarItem(false, onProfile, icon = { Icon(Icons.Outlined.PersonOutline, null) }, label = { Text("حسابي") })
    } }) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { Row(verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) {
                Text("المحفوظات", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text("المنشورات التي احتفظت بها للرجوع إليها", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }; IconButton(onClick = onRefresh) { Icon(Icons.Outlined.Refresh, "تحديث") } } }
            if (state.loading && state.feedPosts.isEmpty()) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            if (!state.loading && state.feedPosts.isEmpty()) item { Text("لا توجد منشورات محفوظة", Modifier.fillMaxWidth().padding(28.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(state.feedPosts, key = { it.id }) { post ->
                Card(border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), shape = RoundedCornerShape(16.dp)) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(post.authorName, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                        if (post.content.isNotBlank()) Text(post.content, style = MaterialTheme.typography.bodyLarge)
                        post.images.forEach { AsyncImage(it, "صورة محفوظة", Modifier.fillMaxWidth().heightIn(max = 260.dp)) }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                            TextButton(onClick = { onUnsave(post.id, true) }) { Icon(Icons.Outlined.BookmarkRemove, null); Spacer(Modifier.width(4.dp)); Text("إزالة من المحفوظات") }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(state: NexusUiState, onRefresh: () -> Unit, onRead: (String) -> Unit, onDelete: (String) -> Unit, onBack: () -> Unit) {
    Scaffold(topBar = { TopAppBar(title = { Text("الإشعارات") }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowForward, "رجوع") } }, actions = { IconButton(onClick = onRefresh) { Icon(Icons.Outlined.Refresh, "تحديث") } }) }) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            if (state.notificationsLoading && state.notifications.isEmpty()) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            if (!state.notificationsLoading && state.notifications.isEmpty()) item { Text("لا توجد إشعارات", Modifier.fillMaxWidth().padding(28.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(state.notifications, key = { it.id }) { n ->
                Card(border = BorderStroke(1.dp, if (n.read) MaterialTheme.colorScheme.outlineVariant else MaterialTheme.colorScheme.primary.copy(alpha = .5f)), shape = RoundedCornerShape(14.dp)) {
                    Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(if (n.read) Icons.Outlined.NotificationsNone else Icons.Outlined.NotificationsActive, null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.width(8.dp)); Text(n.title, Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                            if (!n.read) Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.primaryContainer) { Text("جديد", Modifier.padding(horizontal = 8.dp, vertical = 3.dp), style = MaterialTheme.typography.labelSmall) }
                        }
                        Text(n.body, style = MaterialTheme.typography.bodyMedium)
                        Text(n.createdAt.take(16).replace('T',' '), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                            if (!n.read) TextButton(onClick = { onRead(n.id) }) { Text("تحديد كمقروء") }
                            TextButton(onClick = { onDelete(n.id) }) { Text("حذف") }
                        }
                    }
                }
            }
        }
    }
}
