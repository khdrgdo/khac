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
import coil.compose.AsyncImage
import com.nexus.app.data.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GlobalSearchScreen(state: NexusUiState, onSearch: (String) -> Unit, onBack: () -> Unit,
    onOpenPost: (String) -> Unit, onOpenCourse: (String) -> Unit, onStartChat: (String) -> Unit, onOpenProfile: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var tab by rememberSaveable { mutableStateOf("posts") }
    val results = state.searchResults
    Scaffold(topBar = { TopAppBar(title = { Text("البحث") }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowForward, "رجوع") } }) }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(query, { query = it }, Modifier.weight(1f), singleLine = true, placeholder = { Text("ابحث في المنشورات والمقررات والطلاب") }, shape = RoundedCornerShape(13.dp))
                IconButton(onClick = { onSearch(query) }, enabled = query.trim().length >= 2) { Icon(Icons.Outlined.Search, "بحث") }
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FilterChip(tab == "posts", { tab = "posts" }, label = { Text("المنشورات ${results?.posts?.size ?: ""}") })
                FilterChip(tab == "courses", { tab = "courses" }, label = { Text("المقررات ${results?.courses?.size ?: ""}") })
                FilterChip(tab == "users", { tab = "users" }, label = { Text("الطلاب ${results?.users?.size ?: ""}") })
            }
            if (state.searchLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                when(tab) {
                    "posts" -> {
                        val rows = results?.posts.orEmpty()
                        if (rows.isEmpty() && !state.searchLoading) item { Text("لا توجد منشورات مطابقة", Modifier.padding(20.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        items(rows, key = { it.id }) { post -> Card(onClick = { onOpenPost(post.id) }, shape = RoundedCornerShape(13.dp)) { Column(Modifier.fillMaxWidth().padding(12.dp)) {
                            Text(post.authorName, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold); Spacer(Modifier.height(5.dp)); Text(post.content, maxLines = 4)
                            Text(if (post.postType == "question") "سؤال" else "منشور", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                        } } }
                    }
                    "courses" -> {
                        val rows = results?.courses.orEmpty()
                        if (rows.isEmpty() && !state.searchLoading) item { Text("لا توجد مقررات مطابقة", Modifier.padding(20.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        items(rows, key = { it.id }) { course -> Card(onClick = { onOpenCourse(course.id) }, shape = RoundedCornerShape(13.dp)) { Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.MenuBook, null, tint = MaterialTheme.colorScheme.primary); Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { Text(course.name, fontWeight = FontWeight.SemiBold); Text("${course.major} • السنة ${course.year} • الفصل ${course.semester}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }; Icon(Icons.Outlined.ChevronLeft, null)
                        } } }
                    }
                    else -> {
                        val rows = results?.users.orEmpty()
                        if (rows.isEmpty() && !state.searchLoading) item { Text("لا يوجد طلاب مطابقون", Modifier.padding(20.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        items(rows, key = { it.id }) { user -> Card(shape = RoundedCornerShape(13.dp)) { Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            if (!user.avatarUrl.isNullOrBlank()) AsyncImage(user.avatarUrl, null, Modifier.size(40.dp).then(Modifier)) else Surface(shape = CircleShape, color = MaterialTheme.colorScheme.secondaryContainer, modifier = Modifier.size(40.dp)) { Box(contentAlignment = Alignment.Center) { Text(user.fullName.take(1)) } }
                            Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { Text(user.fullName, fontWeight = FontWeight.SemiBold); Text(user.universityNumber, style = MaterialTheme.typography.labelSmall) }; IconButton(onClick = { onOpenProfile(user.id) }) { Icon(Icons.Outlined.Person, "الملف الشخصي") }; IconButton(onClick = { onStartChat(user.id) }) { Icon(Icons.Outlined.Chat, "مراسلة") }
                        } } }
                    }
                }
            }
        }
    }
}
