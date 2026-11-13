package com.nexus.app.ui

import android.content.Intent
import android.net.Uri
import android.text.format.DateUtils
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.nexus.app.BuildConfig
import com.nexus.app.NexusViewModel
import com.nexus.app.data.*
import com.nexus.app.ui.theme.NexusTheme

@Composable
fun NexusApp(viewModel: NexusViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(state.pendingUrl) {
        val url = state.pendingUrl
        if (!url.isNullOrBlank()) {
            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                .onFailure { Toast.makeText(context, "لا يوجد تطبيق مناسب لفتح هذا الملف", Toast.LENGTH_LONG).show() }
            viewModel.clearPendingUrl()
        }
    }
    LaunchedEffect(state.notice) {
        state.notice?.takeIf { it.isNotBlank() }?.let {
            Toast.makeText(context, it, Toast.LENGTH_SHORT).show()
            viewModel.clearMessages()
        }
    }

    NexusTheme(state.themeMode) {
        when (state.screen) {
            AppScreen.LOGIN -> if (state.loading) SplashScreen() else LoginScreen(state, viewModel::signIn, viewModel::recoverPassword)
            AppScreen.HOME -> HomeScreen(state, viewModel::openCourse, viewModel::openMaterial, viewModel::refreshHome, viewModel::showCourses, viewModel::showProfile, viewModel::showFeed)
            AppScreen.FEED -> SocialFeedScreen(state, viewModel::loadFeed, viewModel::publishPost, viewModel::addFeedComment,
                viewModel::uploadPostImage, viewModel::removeDraftImage, viewModel::reactToPost, viewModel::savePost,
                viewModel::reportPost, viewModel::deletePost, viewModel::showHome, viewModel::showCourses, viewModel::showLeaderboard, viewModel::showSavedPosts, viewModel::showNotifications, viewModel::showMessages, viewModel::showSearch, viewModel::votePinnedCard, viewModel::togglePinnedParticipation,
                { url -> runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } }, viewModel::openPostDetail, viewModel::openPublicProfile, { text -> runCatching { context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "مشاركة المنشور")) } }, viewModel::showProfile)
            AppScreen.MESSAGES -> MessagesScreen(state, viewModel::loadConversations, viewModel::searchMessageUsers, viewModel::startDirectChat, viewModel::createGroupChat, viewModel::openChat, viewModel::showHome)
            AppScreen.CHAT -> ChatScreen(state, viewModel::backToMessages, { viewModel.loadChat() }, viewModel::sendChatMessage, viewModel::blockChatUser,
                { userId, reason, note -> state.activeConversationId?.let { viewModel.reportChatUser(it, userId, reason, note) } })
            AppScreen.SAVED -> SavedPostsScreen(state, viewModel::loadSavedPosts, viewModel::savePost, viewModel::showHome, viewModel::showCourses, viewModel::showLeaderboard, viewModel::showProfile)
            AppScreen.NOTIFICATIONS -> NotificationsScreen(state, viewModel::loadNotifications, viewModel::readNotification, viewModel::deleteNotification, viewModel::markAllNotificationsRead, viewModel::clearAllNotifications, viewModel::showHome)
            AppScreen.PUBLIC_PROFILE -> PublicProfileScreen(state, viewModel::backFromPublicProfile, viewModel::startDirectChat, viewModel::openPostDetail)
            AppScreen.SEARCH -> GlobalSearchScreen(state, viewModel::runGlobalSearch, viewModel::showHome, viewModel::openPostDetail, viewModel::openCourseById, viewModel::startDirectChat, viewModel::openPublicProfile)
            AppScreen.POST_DETAIL -> PostDetailScreen(state, viewModel::backToFeed, viewModel::addPostComment, viewModel::acceptPostAnswer, viewModel::deletePostComment)
            AppScreen.ADMIN -> AdminDashboardScreen(state, viewModel::loadAdminData, viewModel::showProfile)
            AppScreen.LEADERBOARD -> LeaderboardScreen(state, viewModel::loadLeaderboard, viewModel::showHome, viewModel::showCourses, viewModel::showProfile)
            AppScreen.COURSES -> CoursesScreen(state, viewModel::openCourse, viewModel::showHome, viewModel::showProfile, viewModel::refreshHome)
            AppScreen.PROFILE -> ProfileScreen(state, viewModel::showHome, viewModel::showCourses, viewModel::showChangePassword, viewModel::setThemeMode, viewModel::updateProfileTheme, viewModel::updateProfileBio, viewModel::updateProfileAvatar, viewModel::showAdmin, viewModel::signOut)
            AppScreen.CHANGE_PASSWORD -> ChangePasswordScreen(state, viewModel::backFromPassword, viewModel::changePassword)
            AppScreen.COURSE_DETAIL -> CourseDetailScreen(state, viewModel::backFromCourse, viewModel::selectCourseTab, viewModel::openMaterial,
                viewModel::postQuestion, viewModel::addComment, viewModel::uploadCourseFile, viewModel::addCourseLink,
                viewModel::deleteCourseMaterial, viewModel::toggleCourseMaterialImportant, viewModel::addCourseUpdate,
                viewModel::editCourseUpdate, viewModel::deleteCourseUpdate, viewModel::updateCourseSchedule)
        }
    }
}

@Composable
private fun SplashScreen() {
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp)) {
            NexusBrand(true, true)
            CircularProgressIndicator(Modifier.size(22.dp), color = MaterialTheme.colorScheme.tertiary, strokeWidth = 2.dp)
        }
    }
}

@Composable
private fun LoginScreen(state: NexusUiState, onSignIn: (String, String) -> Unit, onRecover: (String) -> Unit) {
    val context = LocalContext.current
    var identifier by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    var recoveryOpen by rememberSaveable { mutableStateOf(false) }
    var recoveryIdentifier by rememberSaveable { mutableStateOf("") }

    Column(
        Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.Center
    ) {
        NexusBrand(true)
        Spacer(Modifier.height(38.dp))
        Text("مساحتك الأكاديمية،", style = MaterialTheme.typography.headlineLarge)
        Text("في مكان واحد.", style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.tertiary)
        Spacer(Modifier.height(9.dp))
        Text("تابع مقرراتك وموادك الدراسية وتواصل مع زملائك حول المحتوى الأكاديمي.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(25.dp))

        Card(
            Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
        ) {
            Column(Modifier.padding(19.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                Text("تسجيل الدخول", style = MaterialTheme.typography.titleLarge)
                Text("استخدم بيانات الحساب نفسها التي تدخل بها إلى موقع NEXUS.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedTextField(
                    value = identifier, onValueChange = { identifier = it }, modifier = Modifier.fillMaxWidth(),
                    label = { Text("الرقم الجامعي أو البريد الإلكتروني") },
                    leadingIcon = { Icon(Icons.Outlined.PersonOutline, null) },
                    singleLine = true, shape = RoundedCornerShape(13.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                )
                OutlinedTextField(
                    value = password, onValueChange = { password = it }, modifier = Modifier.fillMaxWidth(),
                    label = { Text("كلمة المرور") }, leadingIcon = { Icon(Icons.Outlined.Lock, null) },
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(if (showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, if (showPassword) "إخفاء كلمة المرور" else "إظهار كلمة المرور")
                        }
                    },
                    singleLine = true, shape = RoundedCornerShape(13.dp),
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
                )
                if (!state.error.isNullOrBlank()) ErrorBanner(state.error)
                Button(
                    onClick = { onSignIn(identifier, password) },
                    enabled = !state.busy && identifier.isNotBlank() && password.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().height(51.dp),
                    shape = RoundedCornerShape(13.dp)
                ) {
                    if (state.busy) CircularProgressIndicator(Modifier.size(18.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                    else Text("دخول إلى NEXUS", fontWeight = FontWeight.Bold)
                }
                TextButton(onClick = { recoveryIdentifier = identifier; recoveryOpen = true }, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                    Text("نسيت كلمة المرور؟", color = MaterialTheme.colorScheme.secondary)
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                OutlinedButton(
                    onClick = {
                        val url = Uri.parse(BuildConfig.WEB_AUTH_URL + "/auth").buildUpon()
                            .appendQueryParameter("redirect_to", "com.nexus.app://login-callback").build()
                        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, url)) }
                            .onFailure { Toast.makeText(context, "تعذّر فتح صفحة تسجيل الدخول", Toast.LENGTH_SHORT).show() }
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(13.dp)
                ) {
                    Icon(Icons.Outlined.OpenInNew, null, Modifier.size(17.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("استخدام تسجيل الدخول في الموقع")
                }
                Text("سيُفتح الموقع في المتصفح ثم تعود إلى التطبيق تلقائياً.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Spacer(Modifier.height(22.dp))
        Text("NEXUS  •  المنصة الأكاديمية", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
    }

    if (recoveryOpen) {
        AlertDialog(
            onDismissRequest = { recoveryOpen = false },
            title = { Text("استعادة كلمة المرور") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("أدخل الرقم الجامعي أو البريد الإلكتروني المرتبط بحسابك.")
                    OutlinedTextField(recoveryIdentifier, { recoveryIdentifier = it }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text("بيانات الحساب") })
                    if (!state.error.isNullOrBlank()) ErrorBanner(state.error)
                }
            },
            confirmButton = {
                TextButton(enabled = !state.busy && recoveryIdentifier.isNotBlank(), onClick = { onRecover(recoveryIdentifier); recoveryOpen = false }) { Text("إرسال الرابط") }
            },
            dismissButton = { TextButton(onClick = { recoveryOpen = false }) { Text("إلغاء") } }
        )
    }
}

@Composable
private fun HomeScreen(
    state: NexusUiState,
    onOpenCourse: (Course) -> Unit,
    onOpenMaterial: (CourseMaterial) -> Unit,
    onRefresh: () -> Unit,
    onCourses: () -> Unit,
    onProfile: () -> Unit,
    onFeed: () -> Unit
) {
    val profile = state.profile
    var query by rememberSaveable { mutableStateOf("") }
    val filtered = state.courses.filter {
        query.isBlank() || it.name.contains(query.trim(), true) || (it.description?.contains(query.trim(), true) == true)
    }

    Scaffold(
        bottomBar = { NexusBottomBar(AppScreen.HOME, {}, onCourses, onProfile) },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 18.dp, bottom = 25.dp),
            verticalArrangement = Arrangement.spacedBy(15.dp)
        ) {
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("NEXUS", style = MaterialTheme.typography.titleLarge.copy(letterSpacing = 3.sp, fontWeight = FontWeight.ExtraBold))
                        Text("مساحتك الأكاديمية", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TextButton(onClick = onFeed) { Icon(Icons.Outlined.Groups, null); Spacer(Modifier.width(4.dp)); Text("المجتمع") }
                        IconButton(onClick = onRefresh, enabled = !state.loading) { Icon(Icons.Outlined.Refresh, "تحديث") }
                        NexusAvatar(profile?.avatarUrl, profile?.fullName ?: "N", 42.dp)
                    }
                }
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("مرحباً، " + (profile?.fullName?.substringBefore(" ") ?: "بك"), style = MaterialTheme.typography.headlineMedium)
                    Text(listOfNotNull(profile?.major?.let(::majorLabel), profile?.year?.let { "السنة " + it }).joinToString("  •  "), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            item { StudyOverviewCard(state.courses.size, state.courses.sumOf { it.fileCount }, onCourses) }
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    SectionTitle("مقرراتك")
                    TextButton(onClick = onCourses) { Text("عرض الكل") }
                }
            }
            item {
                OutlinedTextField(
                    query, { query = it }, Modifier.fillMaxWidth(),
                    placeholder = { Text("ابحث عن مقرر أو موضوع...") },
                    leadingIcon = { Icon(Icons.Outlined.Search, null) }, singleLine = true,
                    shape = RoundedCornerShape(13.dp)
                )
            }
            if (state.loading && state.courses.isEmpty()) {
                item { LoadingBlock("جارٍ تحميل مقرراتك") }
            } else if (filtered.isEmpty()) {
                item { EmptyState(Icons.Outlined.MenuBook, "لا توجد مقررات مطابقة", "جرّب تغيير البحث أو راجع تخصصك في حسابك.") }
            } else {
                items(filtered.take(5), key = { it.id }) { course -> CourseCard(course) { onOpenCourse(course) } }
            }
            if (state.recentMaterials.isNotEmpty()) {
                item { SectionTitle("أضيف حديثاً", "مواد من مقرراتك") }
                items(state.recentMaterials.take(5), key = { it.id }) { material ->
                    RecentMaterialCard(material) { onOpenMaterial(material) }
                }
            }
            if (!state.error.isNullOrBlank()) item { ErrorBanner(state.error) }
        }
    }
}

@Composable
private fun CoursesScreen(
    state: NexusUiState,
    onOpenCourse: (Course) -> Unit,
    onHome: () -> Unit,
    onProfile: () -> Unit,
    onRefresh: () -> Unit
) {
    var query by rememberSaveable { mutableStateOf("") }
    var yearFilter by rememberSaveable { mutableStateOf(0) }
    var semesterFilter by rememberSaveable { mutableStateOf(0) }
    val filtered = state.courses.filter {
        (query.isBlank() || it.name.contains(query.trim(), true) || (it.description?.contains(query.trim(), true) == true)) &&
            (yearFilter == 0 || it.year == yearFilter) && (semesterFilter == 0 || it.semester == semesterFilter)
    }

    Scaffold(
        bottomBar = { NexusBottomBar(AppScreen.COURSES, onHome, {}, onProfile) },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(13.dp)
        ) {
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("المقررات", style = MaterialTheme.typography.headlineLarge)
                        Text(state.courses.size.toString() + " مقرر في تخصصك", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    }
                    IconButton(onClick = onRefresh, enabled = !state.loading) { Icon(Icons.Outlined.Refresh, "تحديث") }
                }
            }
            item {
                OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), placeholder = { Text("ابحث باسم المقرر...") }, leadingIcon = { Icon(Icons.Outlined.Search, null) }, singleLine = true, shape = RoundedCornerShape(13.dp))
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.FilterList, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("تصفية المقررات", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        FilterChip(yearFilter == 0, { yearFilter = 0 }, label = { Text("كل السنوات") })
                        (1..4).forEach { year -> FilterChip(yearFilter == year, { yearFilter = year }, label = { Text("السنة " + year) }) }
                    }
                    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        FilterChip(semesterFilter == 0, { semesterFilter = 0 }, label = { Text("كل الفصول") })
                        (1..2).forEach { semester -> FilterChip(semesterFilter == semester, { semesterFilter = semester }, label = { Text("الفصل " + semester) }) }
                    }
                }
            }
            if (state.loading && state.courses.isEmpty()) item { LoadingBlock("جارٍ تحميل المقررات") }
            else if (filtered.isEmpty()) item { EmptyState(Icons.Outlined.MenuBook, "لا توجد مقررات", "لا توجد نتائج لهذه التصفية حالياً.") }
            else items(filtered, key = { it.id }) { course -> CourseCard(course) { onOpenCourse(course) } }
            if (!state.error.isNullOrBlank()) item { ErrorBanner(state.error) }
        }
    }
}

@Composable
private fun StudyOverviewCard(courseCount: Int, materialCount: Int, onClick: () -> Unit) {
    Card(
        onClick = onClick, modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Text("مساحة الدراسة", color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.72f), style = MaterialTheme.typography.labelLarge)
                Text("كل ما تحتاجه لمتابعة دراستك.", color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.titleLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    OverviewMetric(courseCount.toString(), "مقررات")
                    OverviewMetric(materialCount.toString(), "ملفات")
                }
            }
            Box(Modifier.size(58.dp).clip(RoundedCornerShape(17.dp)).background(MaterialTheme.colorScheme.tertiary.copy(alpha = 0.16f)), contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.School, null, tint = MaterialTheme.colorScheme.tertiary, modifier = Modifier.size(31.dp))
            }
        }
    }
}

@Composable
private fun OverviewMetric(value: String, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(value, color = MaterialTheme.colorScheme.tertiary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Text(label, color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.76f), style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun CourseCard(course: Course, onClick: () -> Unit) {
    val haptic = LocalHapticFeedback.current
    Card(
        onClick = { haptic.performHapticFeedback(HapticFeedbackType.LongPress); onClick() },
        modifier = Modifier.fillMaxWidth().animateContentSize(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(Modifier.padding(15.dp), verticalAlignment = Alignment.Top) {
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(13.dp)).background(MaterialTheme.colorScheme.secondaryContainer), contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.MenuBook, null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(23.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(course.name, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (!course.description.isNullOrBlank()) Text(course.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                    MetaPill("السنة " + course.year)
                    MetaPill("الفصل " + course.semester)
                    Text(majorLabel(course.major), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(13.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (!course.teacherName.isNullOrBlank()) Text(course.teacherName, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Description, null, Modifier.size(13.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(course.fileCount.toString(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Link, null, Modifier.size(13.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(course.linkCount.toString(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            Icon(Icons.Outlined.ArrowForward, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
private fun MetaPill(text: String) {
    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(7.dp)) {
        Text(text, Modifier.padding(horizontal = 7.dp, vertical = 4.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun RecentMaterialCard(material: CourseMaterial, onClick: () -> Unit) {
    Card(
        onClick = onClick, modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(13.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            ResourceGlyph(material)
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(material.title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(material.courseName ?: "مادة دراسية", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (material.important) Icon(Icons.Outlined.PushPin, "مهم", tint = MaterialTheme.colorScheme.tertiary, modifier = Modifier.size(17.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CourseDetailScreen(
    state: NexusUiState,
    onBack: () -> Unit,
    onTab: (CourseTab) -> Unit,
    onOpenMaterial: (CourseMaterial) -> Unit,
    onPostQuestion: (String, String, Boolean) -> Unit,
    onAddComment: (String, String, String) -> Unit,
    onUploadFile: (String, Uri) -> Unit,
    onAddLink: (String, String, String) -> Unit,
    onDeleteMaterial: (CourseMaterial) -> Unit,
    onToggleImportant: (CourseMaterial) -> Unit,
    onAddUpdate: (String, String) -> Unit,
    onEditUpdate: (String, String, String) -> Unit,
    onDeleteUpdate: (String, String) -> Unit,
    onSaveSchedule: (String, List<ScheduleEntry>) -> Unit
) {
    val detail = state.courseDetail
    val course = detail?.course ?: state.selectedCourse
    val profile = state.profile
    val canManage = profile?.roles?.contains("sub_admin") != true && (profile?.roles?.any { it == "admin" || it == "teacher" } == true || (course?.teacherId != null && course.teacherId == profile?.id))
    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        val courseId = course?.id ?: return@rememberLauncherForActivityResult
        uris.forEach { onUploadFile(courseId, it) }
    }
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                        Text("المقرر الدراسي", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(course?.name ?: "تفاصيل المقرر", style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowBack, "رجوع") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        if (state.detailLoading && detail == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { LoadingBlock("جارٍ تحميل محتوى المقرر") }
        } else if (detail == null) {
            Column(Modifier.fillMaxSize().padding(padding).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                ErrorBanner(state.error ?: "تعذّر تحميل هذا المقرر")
                OutlinedButton(onClick = onBack) { Text("العودة") }
            }
        } else {
            Column(Modifier.fillMaxSize().padding(padding)) {
                CourseDetailHeader(detail)
                ScrollableTabRow(
                    selectedTabIndex = CourseTab.entries.indexOf(state.selectedTab),
                    edgePadding = 16.dp,
                    containerColor = MaterialTheme.colorScheme.background
                ) {
                    CourseTab.entries.forEach { tab ->
                        Tab(
                            selected = state.selectedTab == tab,
                            onClick = { onTab(tab) },
                            text = { Text(tab.label, maxLines = 1) },
                            icon = {
                                Icon(
                                    when (tab) {
                                        CourseTab.FILES -> Icons.Outlined.Description
                                        CourseTab.LINKS -> Icons.Outlined.Link
                                        CourseTab.DISCUSSIONS -> Icons.Outlined.Forum
                                        CourseTab.UPDATES -> Icons.Outlined.Campaign
                                        CourseTab.SCHEDULE -> Icons.Outlined.CalendarMonth
                                    },
                                    null, Modifier.size(17.dp)
                                )
                            }
                        )
                    }
                }
                AnimatedContent(targetState = state.selectedTab, label = "course-tab") { tab ->
                    when (tab) {
                        CourseTab.FILES -> MaterialsContent(detail.files, onOpenMaterial, "لا توجد ملفات بعد", "ستظهر هنا المحاضرات والمذكرات والملفات التي يضيفها المدرّس.", canManage, detail.course.id, true,
                            onUpload = { filePicker.launch(arrayOf("*/*")) }, onAddLink = { _, _ -> }, onDelete = onDeleteMaterial, onToggleImportant = onToggleImportant)
                        CourseTab.LINKS -> MaterialsContent(detail.links, onOpenMaterial, "لا توجد مصادر خارجية", "ستظهر هنا روابط المحاضرات والمراجع والمصادر الخارجية.", canManage, detail.course.id, false,
                            onUpload = {}, onAddLink = { title, url -> onAddLink(detail.course.id, title, url) }, onDelete = onDeleteMaterial, onToggleImportant = onToggleImportant)
                        CourseTab.DISCUSSIONS -> DiscussionsContent(detail.course.id, detail.questions, state.busy, profile?.roles?.contains("sub_admin") != true, onPostQuestion, onAddComment)
                        CourseTab.UPDATES -> UpdatesContent(detail.course.id, detail.updates, canManage, onAddUpdate, onEditUpdate, onDeleteUpdate)
                        CourseTab.SCHEDULE -> ScheduleContent(detail.course.id, detail.course.schedule, canManage, onSaveSchedule)
                    }
                }
                if (!state.error.isNullOrBlank()) ErrorBanner(state.error, Modifier.padding(horizontal = 16.dp, vertical = 6.dp))
            }
        }
    }
}

@Composable
private fun CourseDetailHeader(detail: CourseDetail) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(detail.course.name, style = MaterialTheme.typography.headlineMedium)
        if (!detail.course.description.isNullOrBlank()) Text(detail.course.description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3, overflow = TextOverflow.Ellipsis)
        Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
            MetaPill(majorLabel(detail.course.major))
            MetaPill("السنة " + detail.course.year)
            MetaPill("الفصل " + detail.course.semester)
        }
        if (!detail.course.teacherName.isNullOrBlank()) Text("أستاذ المقرر: " + detail.course.teacherName, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
    }
}

@Composable
private fun MaterialsContent(materials: List<CourseMaterial>, onOpen: (CourseMaterial) -> Unit, emptyTitle: String, emptyBody: String,
    canManage: Boolean, courseId: String, isFile: Boolean, onUpload: () -> Unit, onAddLink: (String, String) -> Unit,
    onDelete: (CourseMaterial) -> Unit, onToggleImportant: (CourseMaterial) -> Unit) {
    var addLinkOpen by rememberSaveable(courseId) { mutableStateOf(false) }
    var linkTitle by rememberSaveable(courseId) { mutableStateOf("") }
    var linkUrl by rememberSaveable(courseId) { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
        if (canManage) {
            Button(onClick = { if (isFile) onUpload() else addLinkOpen = true }, modifier = Modifier.fillMaxWidth()) {
                Icon(if (isFile) Icons.Outlined.UploadFile else Icons.Outlined.AddLink, null); Spacer(Modifier.width(7.dp)); Text(if (isFile) "رفع ملفات أو فيديو" else "إضافة رابط جديد")
            }
        }
        if (materials.isEmpty()) EmptyState(Icons.Outlined.Description, emptyTitle, emptyBody)
        else materials.forEach { material ->
            MaterialRow(material) { onOpen(material) }
            if (canManage) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = { onToggleImportant(material) }) { Icon(Icons.Outlined.PushPin, null); Text(if (material.important) "إلغاء التثبيت" else "تثبيت كمهم") }
                TextButton(onClick = { onDelete(material) }) { Icon(Icons.Outlined.DeleteOutline, null); Text("حذف") }
            }
        }
    }
    if (addLinkOpen) AlertDialog(onDismissRequest = { addLinkOpen = false }, title = { Text("إضافة رابط للمقرر") },
        text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(linkTitle, { linkTitle = it }, label = { Text("عنوان الرابط") }, singleLine = true)
            OutlinedTextField(linkUrl, { linkUrl = it }, label = { Text("الرابط https://") }, singleLine = true)
        } }, confirmButton = { TextButton(onClick = { onAddLink(linkTitle, linkUrl); linkTitle = ""; linkUrl = ""; addLinkOpen = false }, enabled = linkTitle.isNotBlank() && linkUrl.startsWith("https://")) { Text("إضافة") } },
        dismissButton = { TextButton(onClick = { addLinkOpen = false }) { Text("إلغاء") } })
}

@Composable
private fun MaterialRow(material: CourseMaterial, onClick: () -> Unit) {
    Card(
        onClick = onClick, modifier = Modifier.fillMaxWidth().animateContentSize(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
            ResourceGlyph(material)
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(material.title, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                    if (material.important) Icon(Icons.Outlined.PushPin, "مادة مهمة", tint = MaterialTheme.colorScheme.tertiary, modifier = Modifier.size(15.dp))
                }
                if (!material.note.isNullOrBlank()) Text(material.note, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3, overflow = TextOverflow.Ellipsis)
                Text(relativeTime(material.createdAt), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(if (material.isFile) Icons.Outlined.Download else Icons.Outlined.OpenInNew, if (material.isFile) "فتح الملف" else "فتح الرابط", tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(19.dp))
        }
    }
}

@Composable
private fun ResourceGlyph(material: CourseMaterial) {
    val (icon, tint, lightBg) = when {
        !material.isFile -> Triple(Icons.Outlined.Link, Color(0xFF9A743D), Color(0xFFF4EBDD))
        material.extension == "pdf" -> Triple(Icons.Outlined.PictureAsPdf, Color(0xFFB64C4C), Color(0xFFF7E8E7))
        material.extension in listOf("mp4", "mov", "webm", "mkv", "avi") -> Triple(Icons.Outlined.VideoLibrary, Color(0xFF655A9C), Color(0xFFEEEBF7))
        material.extension in listOf("doc", "docx") -> Triple(Icons.Outlined.Description, Color(0xFF426D9A), Color(0xFFE8EEF5))
        else -> Triple(Icons.Outlined.InsertDriveFile, MaterialTheme.colorScheme.secondary, MaterialTheme.colorScheme.secondaryContainer)
    }
    val dark = MaterialTheme.colorScheme.background == Color(0xFF151F2D)
    Box(Modifier.size(43.dp).clip(RoundedCornerShape(12.dp)).background(if (dark) MaterialTheme.colorScheme.secondaryContainer else lightBg), contentAlignment = Alignment.Center) {
        Icon(icon, null, tint = if (dark) MaterialTheme.colorScheme.tertiary else tint, modifier = Modifier.size(22.dp))
    }
}

@Composable
private fun DiscussionsContent(
    courseId: String,
    questions: List<CourseQuestion>,
    busy: Boolean,
    canComment: Boolean,
    onPostQuestion: (String, String, Boolean) -> Unit,
    onAddComment: (String, String, String) -> Unit
) {
    var questionText by rememberSaveable(courseId) { mutableStateOf("") }
    var anonymous by rememberSaveable(courseId) { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.Forum, tint = MaterialTheme.colorScheme.secondary, contentDescription = null)
                    Text("لديك سؤال حول المقرر؟", style = MaterialTheme.typography.titleMedium)
                }
                OutlinedTextField(questionText, { questionText = it }, Modifier.fillMaxWidth(), enabled = canComment, placeholder = { Text(if (canComment) "اكتب سؤالك بوضوح..." else "حساب المشرف المساعد لا يملك صلاحية النشر") }, minLines = 3, maxLines = 5, shape = RoundedCornerShape(12.dp))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        Switch(anonymous, { anonymous = it }, enabled = canComment)
                        Text("نشر كمجهول", style = MaterialTheme.typography.bodySmall)
                    }
                    Button(
                        onClick = { onPostQuestion(courseId, questionText, anonymous); questionText = ""; anonymous = false },
                        enabled = !busy && canComment && questionText.isNotBlank(), shape = RoundedCornerShape(11.dp)
                    ) {
                        Icon(Icons.Outlined.Send, null, Modifier.size(16.dp))
                        Spacer(Modifier.width(5.dp))
                        Text("نشر السؤال")
                    }
                }
            }
        }
        if (questions.isEmpty()) EmptyState(Icons.Outlined.Forum, "لا توجد نقاشات بعد", "ابدأ بطرح أول سؤال ليستفيد منه زملاؤك وأستاذ المقرر.")
        else questions.forEach { QuestionCard(it, courseId, busy, canComment, onAddComment) }
    }
}

@Composable
private fun QuestionCard(question: CourseQuestion, courseId: String, busy: Boolean, canComment: Boolean, onAddComment: (String, String, String) -> Unit) {
    var reply by rememberSaveable(question.id) { mutableStateOf("") }
    var expanded by rememberSaveable(question.id) { mutableStateOf(true) }
    Card(
        Modifier.fillMaxWidth().animateContentSize(),
        shape = RoundedCornerShape(15.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ProfileAvatar(question.avatarUrl, question.authorName, 35)
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(question.authorName, style = MaterialTheme.typography.labelLarge)
                        if (question.verified) Icon(Icons.Outlined.CheckCircle, "موثق", tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(14.dp))
                    }
                    Text(relativeTime(question.createdAt), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                AssistChip(onClick = { expanded = !expanded }, label = { Text("الردود " + question.replies.size) }, leadingIcon = { Icon(Icons.Outlined.Forum, null, Modifier.size(14.dp)) })
            }
            Text(question.content, style = MaterialTheme.typography.bodyLarge)
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            if (expanded) {
                question.replies.forEach { CommentRow(it) }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    OutlinedTextField(reply, { reply = it }, Modifier.weight(1f), enabled = canComment, placeholder = { Text("اكتب إجابة أو تعليقاً...") }, singleLine = true, shape = RoundedCornerShape(11.dp))
                    IconButton(
                        enabled = !busy && canComment && reply.isNotBlank(),
                        onClick = { onAddComment(courseId, question.id, reply); reply = "" }
                    ) { Icon(Icons.Outlined.Send, "إرسال الرد", tint = MaterialTheme.colorScheme.primary) }
                }
            }
        }
    }
}

@Composable
private fun CommentRow(comment: CourseComment) {
    Row(Modifier.fillMaxWidth().padding(start = 9.dp), verticalAlignment = Alignment.Top) {
        ProfileAvatar(comment.avatarUrl, comment.authorName, 27)
        Spacer(Modifier.width(8.dp))
        Column(Modifier.weight(1f).clip(RoundedCornerShape(11.dp)).background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f)).padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(comment.authorName, style = MaterialTheme.typography.labelLarge)
                if (comment.isTeacher) Text("أستاذ المقرر", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.secondary)
                Spacer(Modifier.weight(1f))
                Text(relativeTime(comment.createdAt), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(comment.content, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun UpdatesContent(courseId: String, updates: List<CourseUpdate>, canManage: Boolean, onAdd: (String, String) -> Unit,
    onEdit: (String, String, String) -> Unit, onDelete: (String, String) -> Unit) {
    var draft by rememberSaveable(courseId) { mutableStateOf("") }
    var editingId by rememberSaveable(courseId) { mutableStateOf<String?>(null) }
    var editDraft by rememberSaveable(courseId) { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (canManage) Card(shape = RoundedCornerShape(15.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("إعلان جديد للطلاب", fontWeight = FontWeight.SemiBold)
                OutlinedTextField(draft, { draft = it }, Modifier.fillMaxWidth(), placeholder = { Text("اكتب تحديثاً أو تنبيهاً...") }, minLines = 2)
                Button(onClick = { onAdd(courseId, draft); draft = "" }, enabled = draft.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Icon(Icons.Outlined.Campaign, null); Spacer(Modifier.width(6.dp)); Text("نشر الإعلان") }
            }
        }
        if (updates.isEmpty()) EmptyState(Icons.Outlined.Campaign, "لا توجد إعلانات", "ستظهر هنا تنبيهات أستاذ المقرر وتحديثاته.")
        else updates.forEach { update ->
            Card(shape = RoundedCornerShape(15.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)) {
                Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(MaterialTheme.colorScheme.tertiary.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Campaign, null, tint = MaterialTheme.colorScheme.tertiary) }
                        Spacer(Modifier.width(9.dp)); Column(Modifier.weight(1f)) { Text(update.authorName, style = MaterialTheme.typography.labelLarge); Text(relativeTime(update.createdAt), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                    Text(update.content, style = MaterialTheme.typography.bodyLarge)
                    if (canManage) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = { editingId = update.id; editDraft = update.content }) { Text("تعديل") }
                        TextButton(onClick = { onDelete(courseId, update.id) }) { Text("حذف") }
                    }
                }
            }
        }
    }
    if (editingId != null) AlertDialog(onDismissRequest = { editingId = null }, title = { Text("تعديل الإعلان") },
        text = { OutlinedTextField(editDraft, { editDraft = it }, Modifier.fillMaxWidth(), minLines = 3) },
        confirmButton = { TextButton(onClick = { editingId?.let { onEdit(courseId, it, editDraft) }; editingId = null }) { Text("حفظ") } },
        dismissButton = { TextButton(onClick = { editingId = null }) { Text("إلغاء") } })
}

@Composable
private fun ScheduleContent(courseId: String, schedule: List<ScheduleEntry>, canManage: Boolean, onSave: (String, List<ScheduleEntry>) -> Unit) {
    var entries by remember(courseId, schedule) { mutableStateOf(schedule) }
    var day by rememberSaveable(courseId) { mutableStateOf("") }
    var start by rememberSaveable(courseId) { mutableStateOf("") }
    var end by rememberSaveable(courseId) { mutableStateOf("") }
    var room by rememberSaveable(courseId) { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
        if (canManage) Card(shape = RoundedCornerShape(15.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Text("إدارة مواعيد المحاضرات", fontWeight = FontWeight.SemiBold)
                OutlinedTextField(day, { day = it }, Modifier.fillMaxWidth(), label = { Text("اليوم (مثلاً الأحد)") }, singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    OutlinedTextField(start, { start = it }, Modifier.weight(1f), label = { Text("من (09:00)") }, singleLine = true)
                    OutlinedTextField(end, { end = it }, Modifier.weight(1f), label = { Text("إلى (11:00)") }, singleLine = true)
                }
                OutlinedTextField(room, { room = it }, Modifier.fillMaxWidth(), label = { Text("القاعة") }, singleLine = true)
                Button(onClick = { entries = entries + ScheduleEntry(day.trim(), start.trim(), end.trim(), room.trim()); day = ""; start = ""; end = ""; room = "" },
                    enabled = day.isNotBlank() && start.matches(Regex("\\d{2}:\\d{2}")) && end.matches(Regex("\\d{2}:\\d{2}")), modifier = Modifier.fillMaxWidth()) { Text("إضافة موعد") }
                Button(onClick = { onSave(courseId, entries) }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Outlined.Save, null); Spacer(Modifier.width(6.dp)); Text("حفظ الجدول") }
            }
        }
        if (entries.isEmpty()) EmptyState(Icons.Outlined.CalendarMonth, "لم يُضف جدول للمقرر", "عندما يحدد أستاذ المقرر مواعيده ستظهر هنا.")
        else entries.forEachIndexed { index, entry ->
            Card(shape = RoundedCornerShape(13.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)) {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(42.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.secondaryContainer), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.CalendarMonth, null, tint = MaterialTheme.colorScheme.secondary) }
                    Spacer(Modifier.width(11.dp)); Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) { Text(entry.day, style = MaterialTheme.typography.titleMedium); Text(entry.room.ifBlank { "القاعة غير محددة" }, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) { Text(entry.start + " – " + entry.end, style = MaterialTheme.typography.labelLarge); Text("وقت المحاضرة", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    if (canManage) IconButton(onClick = { entries = entries.filterIndexed { i, _ -> i != index } }) { Icon(Icons.Outlined.Close, "إزالة الموعد") }
                }
            }
        }
    }
}

@Composable
private fun ProfileScreen(
    state: NexusUiState,
    onHome: () -> Unit,
    onCourses: () -> Unit,
    onChangePassword: () -> Unit,
    onTheme: (ThemeMode) -> Unit,
    onProfileTheme: (String) -> Unit,
    onBioSave: (String) -> Unit,
    onAvatarSelected: (Uri) -> Unit,
    onAdmin: () -> Unit,
    onSignOut: () -> Unit
) {
    val profile = state.profile
    val avatarPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> uri?.let(onAvatarSelected) }
    var bioOpen by rememberSaveable { mutableStateOf(false) }
    var bioDraft by rememberSaveable(profile?.bio) { mutableStateOf(profile?.bio.orEmpty()) }
    val themes = listOf(Triple("stars", "🌟 النجوم المضيئة", 0), Triple("clouds", "☁️ السحاب الهادئ", 100), Triple("moon", "🌙 القمر والكسوف", 300), Triple("sun", "☀️ الشمس والوهج الشمسي", 700), Triple("galaxy", "🌌 السديم الفضائي والأسطورة", 1500))
    val activeTheme = profile?.theme ?: "stars"
    val palette = when (activeTheme) {
        "clouds" -> listOf(Color(0xFF0C4A6E), Color(0xFF164E63))
        "moon" -> listOf(Color(0xFF2E1065), Color(0xFF312E81))
        "sun" -> listOf(Color(0xFF7C2D12), Color(0xFF78350F))
        "galaxy" -> listOf(Color(0xFF581C87), Color(0xFF831843))
        else -> listOf(Color(0xFF0F172A), Color(0xFF312E81))
    }
    Scaffold(bottomBar = { NexusBottomBar(AppScreen.PROFILE, onHome, onCourses, {}) }, containerColor = MaterialTheme.colorScheme.background) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(18.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("حسابي", style = MaterialTheme.typography.headlineLarge)
            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(0.dp)) {
                    Box(Modifier.fillMaxWidth().height(112.dp).background(Brush.linearGradient(palette))) {
                        Text("NEXUS", Modifier.align(Alignment.TopEnd).padding(14.dp), color = Color.White.copy(alpha = .78f), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                    }
                    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(Modifier.offset(y = (-30).dp), verticalAlignment = Alignment.Bottom) {
                            Box {
                                NexusAvatar(profile?.avatarUrl, profile?.fullName ?: "N", 88.dp)
                                Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primary, modifier = Modifier.align(Alignment.BottomEnd).size(28.dp).clickable { avatarPicker.launch("image/*") }) {
                                    Box(contentAlignment = Alignment.Center) { Icon(Icons.Outlined.CameraAlt, "تغيير الصورة", tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(16.dp)) }
                                }
                            }
                            Spacer(Modifier.width(13.dp))
                            Column(Modifier.weight(1f).padding(bottom = 5.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text(profile?.fullName ?: "طالب NEXUS", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                                Text(listOfNotNull(profile?.major?.let(::majorLabel), profile?.year?.let { "السنة $it" }).joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                        Text("الرقم الجامعي: ${profile?.universityNumber.orEmpty()}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.offset(y = (-22).dp))
                        AssistChip(onClick = {}, label = { Text(themes.firstOrNull { it.first == activeTheme }?.second ?: "إطار النجوم") }, leadingIcon = { Icon(Icons.Outlined.Star, null) }, modifier = Modifier.offset(y = (-22).dp))
                    if (!profile?.bio.isNullOrBlank()) Text(profile?.bio.orEmpty(), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) { Text("${profile?.points ?: 0}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold); Text("النقاط", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(themes.lastOrNull { it.third <= (profile?.points ?: 0) }?.second?.substringBefore(' ') ?: "برونزي", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold); Text("المستوى", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(if (profile?.roles?.contains("teacher") == true) "أستاذ" else "طالب", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold); Text("نوع الحساب", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { bioDraft = profile?.bio.orEmpty(); bioOpen = true }, modifier = Modifier.weight(1f)) { Icon(Icons.Outlined.Edit, null); Spacer(Modifier.width(5.dp)); Text("تعديل النبذة") }
                        OutlinedButton(onClick = { avatarPicker.launch("image/*") }, modifier = Modifier.weight(1f)) { Icon(Icons.Outlined.PhotoCamera, null); Spacer(Modifier.width(5.dp)); Text("تغيير الصورة") }
                    }
                    }
                }
            }
            SectionTitle("إطار البطاقة الشخصية")
            Card(shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text("افتح الإطارات بجمع النقاط", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    themes.forEach { (id, label, minPoints) ->
                        val unlocked = (profile?.points ?: 0) >= minPoints
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            FilterChip(selected = activeTheme == id, onClick = { if (unlocked) onProfileTheme(id) }, enabled = unlocked,
                                label = { Text(if (unlocked) label else "$label · 🔒 $minPoints") })
                            Spacer(Modifier.weight(1f))
                            if (activeTheme == id) Icon(Icons.Outlined.CheckCircle, null, tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                    val nextTheme = themes.firstOrNull { it.third > (profile?.points ?: 0) }
                    if (nextTheme != null) {
                        val previous = themes.lastOrNull { it.third <= (profile?.points ?: 0) }?.third ?: 0
                        val progress = ((profile?.points ?: 0) - previous).toFloat() / (nextTheme.third - previous).toFloat()
                        Text("المظهر التالي: ${nextTheme.second} — متبقي ${nextTheme.third - (profile?.points ?: 0)} نقطة", style = MaterialTheme.typography.labelSmall)
                        LinearProgressIndicator(progress = progress.coerceIn(0f, 1f), modifier = Modifier.fillMaxWidth())
                    } else Text("وصلت إلى أعلى إطار متاح.", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelMedium)
                }
            }
            Card(shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                Row(Modifier.fillMaxWidth().clickable { bioDraft = profile?.bio.orEmpty(); bioOpen = true }.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Edit, null, tint = MaterialTheme.colorScheme.secondary); Spacer(Modifier.width(9.dp)); Text("تعديل النبذة الشخصية", Modifier.weight(1f)); Icon(Icons.Outlined.ChevronLeft, null)
                }
            }
            if (profile?.roles?.any { it == "admin" || it == "sub_admin" } == true) {
                Card(shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                    Row(Modifier.fillMaxWidth().clickable(onClick = onAdmin).padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.AdminPanelSettings, null, tint = MaterialTheme.colorScheme.secondary); Spacer(Modifier.width(9.dp)); Text("لوحة الإدارة", Modifier.weight(1f)); Icon(Icons.Outlined.ChevronLeft, null)
                    }
                }
            }
            SectionTitle("إعدادات التطبيق")
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("المظهر", style = MaterialTheme.typography.titleMedium)
                    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        ThemeMode.entries.forEach { mode ->
                            FilterChip(
                                selected = state.themeMode == mode,
                                onClick = { onTheme(mode) },
                                label = { Text(mode.label) },
                                leadingIcon = {
                                    Icon(
                                        when (mode) {
                                            ThemeMode.SYSTEM -> Icons.Outlined.BrightnessAuto
                                            ThemeMode.LIGHT -> Icons.Outlined.LightMode
                                            ThemeMode.DARK -> Icons.Outlined.DarkMode
                                        }, null, Modifier.size(15.dp)
                                    )
                                }
                            )
                        }
                    }
                }
            }
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                Row(Modifier.fillMaxWidth().clickable(onClick = onChangePassword).padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Key, null, tint = MaterialTheme.colorScheme.secondary)
                    Spacer(Modifier.width(11.dp))
                    Text("تغيير كلمة المرور", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                    Icon(Icons.Outlined.ArrowForward, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            OutlinedButton(onClick = onSignOut, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(13.dp), colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                Icon(Icons.Outlined.ExitToApp, null)
                Spacer(Modifier.width(8.dp))
                Text("تسجيل الخروج")
            }
            Text("NEXUS  •  الإصدار 1.3.0", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
        }
    }
    if (bioOpen) AlertDialog(onDismissRequest = { bioOpen = false }, title = { Text("النبذة الشخصية") },
        text = { OutlinedTextField(bioDraft, { bioDraft = it }, modifier = Modifier.fillMaxWidth(), minLines = 3, maxLines = 5, placeholder = { Text("اكتب نبذة قصيرة عنك") }) },
        confirmButton = { TextButton(onClick = { onBioSave(bioDraft); bioOpen = false }) { Text("حفظ") } },
        dismissButton = { TextButton(onClick = { bioOpen = false }) { Text("إلغاء") } })
}

@Composable
private fun ChangePasswordScreen(state: NexusUiState, onBack: () -> Unit, onSave: (String) -> Unit) {
    var password by rememberSaveable { mutableStateOf("") }
    var confirmation by rememberSaveable { mutableStateOf("") }
    var visible by rememberSaveable { mutableStateOf(false) }
    val valid = password.length >= 6 && password == confirmation
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowBack, "رجوع") }
        Icon(Icons.Outlined.Key, null, tint = MaterialTheme.colorScheme.tertiary, modifier = Modifier.size(34.dp))
        Text("تغيير كلمة المرور", style = MaterialTheme.typography.headlineLarge)
        Text("اختر كلمة مرور جديدة لا تقل عن 6 أحرف.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), label = { Text("كلمة المرور الجديدة") }, singleLine = true, shape = RoundedCornerShape(13.dp), visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(), trailingIcon = { IconButton(onClick = { visible = !visible }) { Icon(if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, null) } })
        OutlinedTextField(confirmation, { confirmation = it }, Modifier.fillMaxWidth(), label = { Text("تأكيد كلمة المرور") }, singleLine = true, shape = RoundedCornerShape(13.dp), visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation())
        if (confirmation.isNotEmpty() && password != confirmation) Text("كلمتا المرور غير متطابقتين", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        if (!state.error.isNullOrBlank()) ErrorBanner(state.error)
        Button(onClick = { onSave(password) }, enabled = valid && !state.busy, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(13.dp)) {
            if (state.busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary) else Text("حفظ كلمة المرور")
        }
    }
}

@Composable
private fun NexusBottomBar(selected: AppScreen, onHome: () -> Unit, onCourses: () -> Unit, onProfile: () -> Unit) {
    NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
        NavigationBarItem(selected == AppScreen.HOME, onHome, icon = { Icon(Icons.Outlined.Home, null) }, label = { Text("الرئيسية") })
        NavigationBarItem(selected == AppScreen.COURSES, onCourses, icon = { Icon(Icons.Outlined.MenuBook, null) }, label = { Text("المقررات") })
        NavigationBarItem(selected == AppScreen.PROFILE, onProfile, icon = { Icon(Icons.Outlined.PersonOutline, null) }, label = { Text("حسابي") })
    }
}

@Composable
private fun NexusBrand(showTagline: Boolean, centered: Boolean = false) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = if (centered) Arrangement.Center else Arrangement.Start) {
        Box(Modifier.size(48.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary), contentAlignment = Alignment.Center) {
            Text("N", color = MaterialTheme.colorScheme.tertiary, fontSize = 29.sp, fontWeight = FontWeight.Black)
        }
        Spacer(Modifier.width(11.dp))
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("NEXUS", style = MaterialTheme.typography.titleLarge.copy(letterSpacing = 4.sp, fontWeight = FontWeight.ExtraBold))
            if (showTagline) Text("المنصة الأكاديمية", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun ProfileAvatar(url: String?, name: String, size: Int) {
    if (!url.isNullOrBlank() && url.startsWith("http")) {
        AsyncImage(model = url, contentDescription = "الصورة الشخصية", modifier = Modifier.size(size.dp).clip(CircleShape))
    } else {
        Box(Modifier.size(size.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) {
            Text(name.trim().firstOrNull()?.uppercase() ?: "N", color = MaterialTheme.colorScheme.onPrimaryContainer, fontWeight = FontWeight.Bold, fontSize = (size / 2.3).sp)
        }
    }
}

@Composable
private fun SectionTitle(title: String, subtitle: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge)
        if (!subtitle.isNullOrBlank()) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ErrorBanner(message: String, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().clip(RoundedCornerShape(11.dp)).background(MaterialTheme.colorScheme.error.copy(alpha = 0.09f)).padding(11.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.ErrorOutline, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun EmptyState(icon: ImageVector, title: String, body: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 30.dp, horizontal = 20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.size(54.dp).clip(RoundedCornerShape(16.dp)).background(MaterialTheme.colorScheme.secondaryContainer), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(27.dp))
        }
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(body, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun LoadingBlock(message: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.tertiary)
        Text(message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun relativeTime(value: String): String = runCatching {
    val instant = java.time.Instant.parse(value)
    DateUtils.getRelativeTimeSpanString(instant.toEpochMilli(), System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS).toString()
}.getOrDefault("")
