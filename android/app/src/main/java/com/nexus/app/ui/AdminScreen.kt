package com.nexus.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.BorderStroke
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
    var tab by rememberSaveable { mutableStateOf("overview") }
    var query by rememberSaveable { mutableStateOf("") }
    var reportFilter by rememberSaveable { mutableStateOf("all") }
    var expandedUser by rememberSaveable { mutableStateOf<String?>(null) }
    val profile = state.profile
    val isMainAdmin = profile?.roles?.contains("admin") == true
    val users = state.adminUsers
    val reports = state.adminReports.filter { reportFilter == "all" || it.reportType == reportFilter }
    val filteredUsers = users.filter { it.fullName.contains(query, true) || it.universityNumber.contains(query, true) || it.roles.any { role -> role.contains(query, true) } }
    Scaffold(topBar = { TopAppBar(title = { Column { Text("مركز الإدارة"); Text("NEXUS · إدارة المجتمع", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowForward, "رجوع") } }, actions = { IconButton(onClick = onRefresh, enabled = !state.adminLoading) { Icon(Icons.Outlined.Refresh, "تحديث") } }) }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            ScrollableTabRow(selectedTabIndex = listOf("overview", "users", "reports").indexOf(tab).coerceAtLeast(0), edgePadding = 12.dp) {
                listOf("overview" to "نظرة عامة", "users" to "المستخدمون", "reports" to "البلاغات").forEach { (key,label) ->
                    if (key != "reports" || isMainAdmin) Tab(selected = tab == key, onClick = { tab = key }, text = { Text(label) })
                }
            }
            if (state.adminLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
            if (!state.error.isNullOrBlank()) Text(state.error, Modifier.padding(12.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            when(tab) {
                "overview" -> LazyColumn(contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    item { Text("ملخص المنصة", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
                    item {
                        val cards = listOf(Triple("إجمالي الحسابات", users.size.toString(), Icons.Outlined.Groups), Triple("الطلاب", users.count { "student" in it.roles }.toString(), Icons.Outlined.School), Triple("الأعضاء المحظورون", users.count { it.banned }.toString(), Icons.Outlined.Block), Triple("البلاغات المعلقة", state.adminReports.count { it.status == "pending" }.toString(), Icons.Outlined.Flag))
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { cards.chunked(2).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { row.forEach { (label,value,icon) -> Card(Modifier.weight(1f), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) { Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) { Icon(icon, null, tint = MaterialTheme.colorScheme.primary); Text(value, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold); Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) } } } } } }
                    }
                    item { Text("توزيع الأدوار", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
                    item { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { listOf("student" to "طلاب", "teacher" to "أساتذة", "admin" to "مديرو النظام", "sub_admin" to "مشرفون مساعدون").forEach { (role,label) -> val count = users.count { role in it.roles }; Row(verticalAlignment = Alignment.CenterVertically) { Text(label, Modifier.width(120.dp), style = MaterialTheme.typography.bodyMedium); LinearProgressIndicator(progress = if (users.isEmpty()) 0f else count.toFloat()/users.size, Modifier.weight(1f)); Text("$count", Modifier.width(38.dp), textAlign = androidx.compose.ui.text.style.TextAlign.End, style = MaterialTheme.typography.labelMedium) } } } }
                    item { Text("آخر البلاغات", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
                    items(state.adminReports.take(5), key = { it.id }) { report -> AdminReportRow(report) }
                    item { Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(12.dp)) { Text("الإجراءات التي تغيّر حسابات المستخدمين أو حالة البلاغات غير مفعّلة في هذه النسخة؛ لن تظهر كأنها تعمل قبل اعتماد صلاحيات قاعدة البيانات واختبارها.", Modifier.padding(12.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
                }
                "users" -> Column(Modifier.fillMaxSize()) {
                    OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), singleLine = true, placeholder = { Text("بحث بالاسم أو الرقم أو الدور") }, leadingIcon = { Icon(Icons.Outlined.Search, null) }, trailingIcon = { if(query.isNotBlank()) IconButton(onClick = { query = "" }) { Icon(Icons.Outlined.Close, "مسح") } })
                    Text("${filteredUsers.size} حساب", Modifier.padding(horizontal = 16.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    LazyColumn(contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(filteredUsers, key = { it.id }) { user ->
                            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                                Column(Modifier.fillMaxWidth().clickable { expandedUser = if(expandedUser == user.id) null else user.id }.padding(13.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) { Surface(shape = CircleShape, color = MaterialTheme.colorScheme.secondaryContainer, modifier = Modifier.size(40.dp)) { Box(contentAlignment = Alignment.Center) { Text(user.fullName.take(1), fontWeight = FontWeight.Bold) } }; Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { Text(user.fullName, fontWeight = FontWeight.SemiBold); Text(user.universityNumber, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }; Text("${user.points} نقطة", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelMedium) }
                                    Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) { user.roles.forEach { AssistChip(onClick = {}, label = { Text(when(it) { "admin" -> "مدير"; "sub_admin" -> "مشرف"; "teacher" -> "أستاذ"; else -> "طالب" }) }) }; if(user.banned) AssistChip(onClick = {}, label = { Text("محظور") }); if(!user.suspendedUntil.isNullOrBlank()) AssistChip(onClick = {}, label = { Text("إيقاف مؤقت") }) }
                                    if(expandedUser == user.id) { HorizontalDivider(); Text("التخصص: ${user.major?.uppercase() ?: "غير محدد"}"); Text("السنة الدراسية: ${user.year?.toString() ?: "غير محددة"}"); Text("معرّف الحساب: ${user.id}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant); Text("الحالة: ${if(user.banned) "محظور" else if(!user.suspendedUntil.isNullOrBlank()) "موقوف مؤقتاً" else "نشط حسب البيانات المتاحة"}", style = MaterialTheme.typography.labelMedium) }
                                }
                            }
                        }
                    }
                }
                else -> Column(Modifier.fillMaxSize()) {
                    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) { listOf("all" to "الكل", "post" to "المنشورات", "message" to "الرسائل").forEach { (key,label) -> FilterChip(reportFilter == key, { reportFilter = key }, label = { Text(label) }) } }
                    LazyColumn(contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                        if(reports.isEmpty()) item { Text("لا توجد بلاغات ضمن هذا التصنيف", Modifier.fillMaxWidth().padding(24.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        items(reports, key = { it.id }) { report -> AdminReportRow(report) }
                    }
                }
            }
        }
    }
}

@Composable
private fun AdminReportRow(report: AdminReport) {
    Card(shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.fillMaxWidth().padding(13.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) { Text(if(report.reportType == "message") "بلاغ رسالة / مستخدم" else "بلاغ منشور", Modifier.weight(1f), fontWeight = FontWeight.SemiBold); AssistChip(onClick = {}, label = { Text(if(report.status == "pending") "قيد المراجعة" else report.status) }) }
            Text(report.content.ifBlank { "لا يوجد نص مرفق بالبلاغ" }, style = MaterialTheme.typography.bodyMedium, maxLines = 5)
            Text("السبب: ${report.reason}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Text("المبلّغ: ${report.reporterName}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if(report.reportType == "message") Text("المستخدم المبلّغ عنه: ${report.reportedUserId.orEmpty()}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(report.createdAt.take(16).replace('T',' '), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
