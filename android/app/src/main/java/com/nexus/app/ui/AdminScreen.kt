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
import com.nexus.app.data.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminDashboardScreen(state: NexusUiState, onRefresh: () -> Unit, onBack: () -> Unit) {
    var tab by rememberSaveable { mutableStateOf("users") }
    var query by rememberSaveable { mutableStateOf("") }
    val profile = state.profile
    val isMainAdmin = profile?.roles?.contains("admin") == true
    val canSeeReports = isMainAdmin
    Scaffold(topBar = { TopAppBar(title = { Text("إدارة NEXUS") }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowForward, "رجوع") } }, actions = { IconButton(onClick = onRefresh) { Icon(Icons.Outlined.Refresh, "تحديث") } }) }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ElevatedCard(Modifier.weight(1f)) { Column(Modifier.padding(12.dp)) { Text("مستخدمون في العينة", style = MaterialTheme.typography.labelSmall); Text("${state.adminUsers.size}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) } }
                ElevatedCard(Modifier.weight(1f)) { Column(Modifier.padding(12.dp)) { Text("بلاغات معلقة", style = MaterialTheme.typography.labelSmall); Text("${state.adminReports.count { it.status == "pending" }}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) } }
            }
            if (!isMainAdmin && profile?.subAdminPermissions?.contains("reports") == true) {
                Text("صلاحية البلاغات ظاهرة في إعدادات المشرف المساعد، لكن سياسة قاعدة البيانات الحالية لا تمنحها وصولاً عاماً للمشرف المساعد؛ لن أعرض بيانات ناقصة على أنها كاملة.", Modifier.padding(horizontal = 14.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
            }
            Surface(color = MaterialTheme.colorScheme.errorContainer, modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp), shape = RoundedCornerShape(12.dp)) {
                Text("عرض إداري للقراءة فقط. إجراءات الحظر وتغيير الأدوار وإدارة البلاغات ستظل معطلة حتى إصلاح صلاحيات قاعدة البيانات والتحقق منها.", Modifier.padding(12.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onErrorContainer)
            }
            Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(tab == "users", { tab = "users" }, label = { Text("المستخدمون") })
                if (canSeeReports) FilterChip(tab == "reports", { tab = "reports" }, label = { Text("البلاغات") })
            }
            if (tab == "users") {
                OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth().padding(horizontal = 12.dp), singleLine = true, placeholder = { Text("بحث بالاسم أو الرقم الجامعي") }, leadingIcon = { Icon(Icons.Outlined.Search, null) })
                val filtered = state.adminUsers.filter { it.fullName.contains(query, true) || it.universityNumber.contains(query, true) }
                LazyColumn(contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (state.adminLoading && filtered.isEmpty()) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
                    items(filtered, key = { it.id }) { user ->
                        Card(shape = RoundedCornerShape(13.dp)) { Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) { Text(user.fullName, Modifier.weight(1f), fontWeight = FontWeight.SemiBold); Text("${user.points} نقطة", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelMedium) }
                            Text(user.universityNumber, style = MaterialTheme.typography.labelSmall)
                            Text(listOfNotNull(user.major?.uppercase(), user.year?.let { "السنة $it" }, user.roles.joinToString()).joinToString(" • "), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (user.banned) Text("محظور", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelSmall)
                            else if (!user.suspendedUntil.isNullOrBlank()) Text("إيقاف مؤقت: ${user.suspendedUntil}", color = MaterialTheme.colorScheme.tertiary, style = MaterialTheme.typography.labelSmall)
                        } }
                    }
                }
            } else {
                LazyColumn(contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (state.adminLoading && state.adminReports.isEmpty()) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
                    if (state.adminReports.isEmpty()) item { Text("لا توجد بلاغات ظاهرة لهذا الحساب", Modifier.padding(20.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    items(state.adminReports, key = { it.id }) { report ->
                        Card(shape = RoundedCornerShape(13.dp)) { Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) { Text("بلاغ منشور", Modifier.weight(1f), fontWeight = FontWeight.SemiBold); AssistChip(onClick = {}, label = { Text(report.status) }) }
                            Text(report.content, style = MaterialTheme.typography.bodyMedium, maxLines = 4)
                            Text("المبلّغ: ${report.reporterName} • السبب: ${report.reason}", style = MaterialTheme.typography.labelSmall)
                        } }
                    }
                }
            }
        }
    }
}
