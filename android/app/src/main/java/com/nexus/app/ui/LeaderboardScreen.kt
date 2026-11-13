package com.nexus.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
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
import coil.compose.AsyncImage
import com.nexus.app.data.*

@Composable
fun LeaderboardScreen(
    state: NexusUiState,
    onLoad: (String, String?, Int?, String?) -> Unit,
    onHome: () -> Unit,
    onCourses: () -> Unit,
    onProfile: () -> Unit
) {
    var timeframe by rememberSaveable { mutableStateOf("all") }
    var major by rememberSaveable { mutableStateOf("all") }
    var year by rememberSaveable { mutableStateOf(0) }
    var courseId by rememberSaveable { mutableStateOf("all") }
    var courseMenuOpen by rememberSaveable { mutableStateOf(false) }
    var search by rememberSaveable { mutableStateOf("") }
    val tiers = listOf(0 to "🥉 برونزي", 100 to "🥈 فضي", 300 to "🥇 ذهبي", 700 to "💠 بلاتيني", 1500 to "💎 ماسي")
    LaunchedEffect(timeframe, major, year, courseId) { onLoad(timeframe, major.takeIf { it != "all" }, year.takeIf { it > 0 }, courseId.takeIf { it != "all" }) }
    val visible = state.leaderboard.filter { it.fullName.contains(search, true) }
    Scaffold(bottomBar = {
        NavigationBar {
            NavigationBarItem(false, onHome, icon = { Icon(Icons.Outlined.Home, null) }, label = { Text("الرئيسية") })
            NavigationBarItem(false, onCourses, icon = { Icon(Icons.Outlined.MenuBook, null) }, label = { Text("المقررات") })
            NavigationBarItem(true, {}, icon = { Icon(Icons.Outlined.EmojiEvents, null) }, label = { Text("الصدارة") })
            NavigationBarItem(false, onProfile, icon = { Icon(Icons.Outlined.PersonOutline, null) }, label = { Text("حسابي") })
        }
    }) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.EmojiEvents, null, tint = MaterialTheme.colorScheme.tertiary, modifier = Modifier.size(30.dp))
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text("لوحة الصدارة", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                        Text("تنافس بالنقاط والمساهمات الأكاديمية", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Spacer(Modifier.weight(1f))
                    IconButton(onClick = { onLoad(timeframe, major.takeIf { it != "all" }, year.takeIf { it > 0 }, courseId.takeIf { it != "all" }) }) { Icon(Icons.Outlined.Refresh, "تحديث") }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(timeframe == "all", { timeframe = "all" }, label = { Text("كل الوقت") })
                    FilterChip(timeframe == "month", { timeframe = "month" }, label = { Text("الشهر") })
                    FilterChip(timeframe == "week", { timeframe = "week" }, label = { Text("الأسبوع") })
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("all" to "كل التخصصات", "it" to "IT", "is" to "IS", "se" to "SE").forEach { (key, label) ->
                        FilterChip(major == key, { major = key; courseId = "all" }, enabled = courseId == "all", label = { Text(label) })
                    }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(year == 0, { year = 0; courseId = "all" }, enabled = courseId == "all", label = { Text("كل السنوات") })
                    (1..4).forEach { y -> FilterChip(year == y, { year = y; courseId = "all" }, enabled = courseId == "all", label = { Text("السنة $y") }) }
                }
            }

            item {
                Box {
                    OutlinedButton(onClick = { courseMenuOpen = true }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Outlined.MenuBook, null); Spacer(Modifier.width(8.dp))
                        Text(state.leaderboardCourses.firstOrNull { it.id == courseId }?.name ?: "كل المقررات")
                        Spacer(Modifier.weight(1f)); Icon(Icons.Outlined.ExpandMore, null)
                    }
                    DropdownMenu(expanded = courseMenuOpen, onDismissRequest = { courseMenuOpen = false }) {
                        DropdownMenuItem(text = { Text("كل المقررات") }, onClick = { courseId = "all"; major = "all"; year = 0; courseMenuOpen = false })
                        state.leaderboardCourses.forEach { course -> DropdownMenuItem(text = { Text(course.name) }, onClick = {
                            courseId = course.id; major = "all"; year = 0; courseMenuOpen = false
                        }) }
                    }
                }
            }
            item {
                OutlinedTextField(search, { search = it }, Modifier.fillMaxWidth(), singleLine = true,
                    placeholder = { Text("ابحث عن طالب") }, leadingIcon = { Icon(Icons.Outlined.Search, null) }, shape = RoundedCornerShape(13.dp))
            }

            item {
                val myRank = visible.indexOfFirst { it.id == state.profile?.id } + 1
                val points = state.profile?.points ?: 0
                val next = tiers.firstOrNull { it.first > points }
                val previous = tiers.lastOrNull { it.first <= points }?.first ?: 0
                Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) { Text("ترتيبك الحالي", Modifier.weight(1f), fontWeight = FontWeight.SemiBold); Text(if (myRank > 0) "#${myRank}" else "غير مصنف", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                        Text("${points} نقطة • ${tiers.last { it.first <= points }.second}", style = MaterialTheme.typography.labelMedium)
                        if (next != null) {
                            Text("المستوى التالي: ${next.second} — متبقي ${next.first - points} نقطة", style = MaterialTheme.typography.labelSmall)
                            LinearProgressIndicator(progress = ((points - previous).toFloat() / (next.first - previous)).coerceIn(0f, 1f), modifier = Modifier.fillMaxWidth())
                        } else Text("وصلت إلى أعلى رتبة!", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            if (state.leaderboardLoading && state.leaderboard.isEmpty()) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            if (!state.leaderboardLoading && visible.isEmpty()) item {
                Text("لا توجد نتائج لهذه التصفية", Modifier.fillMaxWidth().padding(28.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            itemsIndexed(visible, key = { _, user -> user.id }) { index, user ->
                Card(shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                    Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                        Surface(shape = CircleShape, color = when(index) { 0 -> MaterialTheme.colorScheme.tertiaryContainer; 1 -> MaterialTheme.colorScheme.secondaryContainer; 2 -> MaterialTheme.colorScheme.primaryContainer; else -> MaterialTheme.colorScheme.surfaceVariant }, modifier = Modifier.size(34.dp)) {
                            Box(contentAlignment = Alignment.Center) { Text("${index+1}", fontWeight = FontWeight.Bold) }
                        }
                        Spacer(Modifier.width(10.dp))
                        if (!user.avatarUrl.isNullOrBlank()) AsyncImage(user.avatarUrl, null, Modifier.size(44.dp).clip(CircleShape))
                        else Surface(shape = CircleShape, color = MaterialTheme.colorScheme.secondaryContainer, modifier = Modifier.size(44.dp)) { Box(contentAlignment = Alignment.Center) { Text(user.fullName.take(1)) } }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(user.fullName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                            Text(tiers.last { it.first <= user.points }.second, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.tertiary)
                            Text(listOfNotNull(user.major?.uppercase(), user.year?.let { "السنة $it" }).joinToString(" • "), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("${user.score}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                            Text(if (timeframe == "all") "نقطة" else "نقطة الفترة", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}
