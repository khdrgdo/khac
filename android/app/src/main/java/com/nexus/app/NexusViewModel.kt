package com.nexus.app

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.data.ApiException
import com.nexus.app.data.AppScreen
import com.nexus.app.data.Course
import com.nexus.app.data.CourseMaterial
import com.nexus.app.data.CourseTab
import com.nexus.app.data.NexusRepository
import com.nexus.app.data.NexusUiState
import com.nexus.app.data.ThemeMode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class NexusViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = NexusRepository(application)
    private val _state = MutableStateFlow(NexusUiState(themeMode = repository.loadThemeMode()))
    val state: StateFlow<NexusUiState> = _state.asStateFlow()

    fun start(uri: Uri?) {
        if (uri != null) repository.acceptDeepLink(uri)
        if (_state.value.profile != null && uri == null) return
        _state.update { it.copy(busy = false, loading = true, profile = null, error = null) }
        restoreSession()
    }

    fun handleDeepLink(uri: Uri?) = start(uri)

    fun restoreSession() {
        if (_state.value.busy || _state.value.profile != null) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, busy = true, error = null) }
            try {
                val profile = repository.restoreSession()
                if (profile == null) {
                    _state.update { it.copy(loading = false, busy = false, screen = AppScreen.LOGIN) }
                } else {
                    _state.update { it.copy(profile = profile, loading = false, busy = false, screen = AppScreen.FEED) }
                    loadFeed()
                }
            } catch (error: Exception) {
                runCatching { repository.signOut() }
                _state.update {
                    it.copy(loading = false, busy = false, screen = AppScreen.LOGIN, profile = null, error = error.message ?: "تعذّر استعادة جلسة الدخول")
                }
            }
        }
    }

    fun signIn(identifier: String, password: String) {
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                val profile = repository.signIn(identifier, password)
                _state.update { it.copy(busy = false, loading = false, profile = profile, screen = AppScreen.FEED, notice = "مرحباً بعودتك، " + profile.fullName) }
                loadFeed()
            } catch (error: Exception) {
                _state.update { it.copy(busy = false, loading = false, error = error.message ?: "تعذّر تسجيل الدخول") }
            }
        }
    }

    fun loadHome() {
        val profile = _state.value.profile ?: return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val result = repository.loadHome(profile)
                _state.update { it.copy(loading = false, courses = result.first, recentMaterials = result.second) }
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message ?: "تعذّر تحميل المقررات") }
            }
        }
    }

    fun refreshHome() = loadHome()

    fun showFeed() {
        _state.update { it.copy(screen = AppScreen.FEED, error = null) }
        loadFeed()
    }

    fun loadFeed() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val posts = repository.loadFeed()
                val card = runCatching { repository.loadPinnedCard() }.getOrNull()
                _state.update { it.copy(loading = false, feedPosts = posts, pinnedCard = card) }
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message ?: "تعذّر تحميل المنشورات") }
            }
        }
    }

    fun votePinnedCard(optionId: String) { viewModelScope.launch { try {
        repository.voteOnPinnedPoll(optionId); _state.update { it.copy(pinnedCard = repository.loadPinnedCard(), notice = "تم تسجيل تصويتك") }
    } catch (e: Exception) { _state.update { it.copy(error = e.message ?: "تعذّر التصويت") } } } }

    fun togglePinnedParticipation() { viewModelScope.launch { try {
        repository.togglePinnedParticipation(); _state.update { it.copy(pinnedCard = repository.loadPinnedCard(), notice = "تم تحديث مشاركتك") }
    } catch (e: Exception) { _state.update { it.copy(error = e.message ?: "تعذّر تحديث المشاركة") } } } }


    fun publishPost(content: String, anonymous: Boolean, postType: String = "general") {
        if (content.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                repository.createFeedPost(content, anonymous, postType, _state.value.draftImagePaths)
                val posts = repository.loadFeed()
                _state.update { it.copy(busy = false, feedPosts = posts, draftImagePaths = emptyList(), notice = "تم نشر مساهمتك") }
            } catch (error: Exception) {
                _state.update { it.copy(busy = false, error = error.message ?: "تعذّر نشر المساهمة") }
            }
        }
    }


    fun uploadPostImage(uri: Uri) {
        viewModelScope.launch {
            try {
                if (_state.value.draftImagePaths.size >= 4) throw ApiException("الحد الأقصى أربع صور")
                val path = repository.uploadPostImage(uri)
                _state.update { it.copy(draftImagePaths = (it.draftImagePaths + path).take(4), notice = "تم إرفاق الصورة") }
            } catch (error: Exception) {
                _state.update { it.copy(error = error.message ?: "تعذّر رفع الصورة") }
            }
        }
    }

    fun removeDraftImage(path: String) { _state.update { it.copy(draftImagePaths = it.draftImagePaths - path) } }

    fun reactToPost(postId: String, reaction: String?) {
        viewModelScope.launch { runCatching { repository.togglePostReaction(postId, reaction); repository.loadFeed() }
            .onSuccess { posts -> _state.update { it.copy(feedPosts = posts) } }
            .onFailure { error -> _state.update { it.copy(error = error.message ?: "تعذّر تسجيل التفاعل") } } }
    }

    fun savePost(postId: String, saved: Boolean) {
        viewModelScope.launch { runCatching { repository.toggleSavedPost(postId, saved); repository.loadFeed() }
            .onSuccess { posts -> _state.update { it.copy(feedPosts = posts, notice = if (saved) "أُزيل من المحفوظات" else "أُضيف إلى المحفوظات") } }
            .onFailure { error -> _state.update { it.copy(error = error.message ?: "تعذّر حفظ المنشور") } } }
    }

    fun reportPost(postId: String, reason: String) {
        viewModelScope.launch { runCatching { repository.reportPost(postId, reason) }
            .onSuccess { _state.update { it.copy(notice = "تم إرسال البلاغ للمراجعة") } }
            .onFailure { error -> _state.update { it.copy(error = error.message ?: "تعذّر إرسال البلاغ") } } }
    }

    fun deletePost(postId: String) {
        viewModelScope.launch { runCatching { repository.deletePost(postId); repository.loadFeed() }
            .onSuccess { posts -> _state.update { it.copy(feedPosts = posts, notice = "تم حذف المنشور") } }
            .onFailure { error -> _state.update { it.copy(error = error.message ?: "تعذّر حذف المنشور") } } }
    }

    fun addFeedComment(postId: String, content: String) {
        if (content.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                repository.addComment(postId, content)
                val posts = repository.loadFeed()
                _state.update { it.copy(busy = false, feedPosts = posts, notice = "تم إرسال تعليقك") }
            } catch (error: Exception) {
                _state.update { it.copy(busy = false, error = error.message ?: "تعذّر إرسال التعليق") }
            }
        }
    }


    fun showAdmin() {
        val roles = _state.value.profile?.roles.orEmpty()
        if (roles.none { it == "admin" || it == "sub_admin" }) { _state.update { it.copy(error = "هذه الصفحة مخصصة للإدارة") }; return }
        _state.update { it.copy(screen = AppScreen.ADMIN, error = null) }; loadAdminData()
    }
    fun loadAdminData() { viewModelScope.launch {
        _state.update { it.copy(adminLoading = true) }
        val users = runCatching { repository.loadAdminUsers() }
        val reports = if (_state.value.profile?.roles?.contains("admin") == true) runCatching { repository.loadAdminReports() } else Result.success(emptyList())
        _state.update { it.copy(adminUsers = users.getOrDefault(emptyList()), adminReports = reports.getOrDefault(emptyList()), adminLoading = false,
            error = users.exceptionOrNull()?.message ?: reports.exceptionOrNull()?.message) }
    } }

    fun updateProfileTheme(theme: String) { viewModelScope.launch { runCatching { repository.updateProfileTheme(theme); repository.loadCurrentProfile() }.onSuccess { profile -> _state.update { it.copy(profile = profile, notice = "تم تحديث إطار البطاقة") } }.onFailure { e -> _state.update { it.copy(error = e.message ?: "تعذّر حفظ الإطار") } } } }
    fun updateProfileBio(bio: String) { viewModelScope.launch { runCatching { repository.updateProfileBio(bio); repository.loadCurrentProfile() }.onSuccess { profile -> _state.update { it.copy(profile = profile, notice = "تم تحديث النبذة") } }.onFailure { e -> _state.update { it.copy(error = e.message ?: "تعذّر حفظ النبذة") } } } }

    fun showMessages() { _state.update { it.copy(screen = AppScreen.MESSAGES, error = null) }; loadConversations() }
    fun loadConversations() { viewModelScope.launch { _state.update { it.copy(messagesLoading = true) }; runCatching { repository.loadConversations() }.onSuccess { rows -> _state.update { it.copy(conversations = rows, messagesLoading = false) } }.onFailure { e -> _state.update { it.copy(messagesLoading = false, error = e.message) } } } }
    fun searchMessageUsers(query: String) { viewModelScope.launch { runCatching { repository.searchPublicUsers(query) }.onSuccess { rows -> _state.update { it.copy(messageSearchResults = rows) } }.onFailure { e -> _state.update { it.copy(error = e.message) } } } }
    fun openChat(id: String) { _state.update { it.copy(screen = AppScreen.CHAT, activeConversationId = id, messages = emptyList()) }; loadChat(id) }
    fun loadChat(id: String = _state.value.activeConversationId.orEmpty()) { if (id.isBlank()) return; viewModelScope.launch { runCatching { repository.loadMessages(id) }.onSuccess { rows -> _state.update { it.copy(messages = rows) } }.onFailure { e -> _state.update { it.copy(error = e.message) } } } }
    fun startDirectChat(otherId: String) { viewModelScope.launch { runCatching { repository.createDirectConversation(otherId) }.onSuccess { id -> loadConversations(); openChat(id) }.onFailure { e -> _state.update { it.copy(error = e.message) } } } }
    fun sendChatMessage(content: String) { val id = _state.value.activeConversationId ?: return; viewModelScope.launch { runCatching { repository.sendMessage(id, content); repository.loadMessages(id) }.onSuccess { rows -> _state.update { it.copy(messages = rows) }; loadConversations() }.onFailure { e -> _state.update { it.copy(error = e.message) } } } }
    fun blockChatUser(userId: String) { viewModelScope.launch { runCatching { repository.blockUser(userId) }.onSuccess { _state.update { it.copy(notice = "تم حظر المستخدم") } }.onFailure { e -> _state.update { it.copy(error = e.message) } } } }
    fun reportChatUser(conversationId: String, userId: String, reason: String, note: String?) { viewModelScope.launch { runCatching { repository.reportMessageUser(conversationId, userId, reason, note) }.onSuccess { _state.update { it.copy(notice = "تم إرسال البلاغ") } }.onFailure { e -> _state.update { it.copy(error = e.message) } } } }
    fun backToMessages() { _state.update { it.copy(screen = AppScreen.MESSAGES, activeConversationId = null) }; loadConversations() }


    fun openPostDetail(postId: String) { _state.update { it.copy(screen = AppScreen.POST_DETAIL, postDetail = null, postDetailLoading = true) }; loadPostDetail(postId) }
    fun loadPostDetail(postId: String) { viewModelScope.launch { runCatching { repository.loadPostDetail(postId) }.onSuccess { detail -> _state.update { it.copy(postDetail = detail, postDetailLoading = false) } }.onFailure { e -> _state.update { it.copy(postDetailLoading = false, error = e.message) } } }
    fun addPostComment(content: String, anonymous: Boolean, parentId: String?) {
        val detail = _state.value.postDetail ?: return
        val profile = _state.value.profile
        if (profile?.roles?.contains("sub_admin") == true) { _state.update { it.copy(error = "حساب المشرف المساعد مخصص للإشراف ولا يملك صلاحية التعليق") }; return }
        val suspended = profile?.suspendedUntil?.let { runCatching { java.time.Instant.parse(it).epochSecond > System.currentTimeMillis()/1000L }.getOrDefault(false) } == true
        if (suspended) { _state.update { it.copy(error = "حسابك موقوف مؤقتاً ولا يمكنه التعليق") }; return }
        viewModelScope.launch { runCatching { repository.createPostComment(detail.post.id, content, anonymous, parentId); repository.loadPostDetail(detail.post.id) }
            .onSuccess { refreshed -> _state.update { it.copy(postDetail = refreshed, notice = "تم نشر التعليق") } }
            .onFailure { e -> _state.update { it.copy(error = e.message ?: "تعذّر نشر التعليق") } } }
    }
    fun acceptPostAnswer(commentId: String?) {
        val detail = _state.value.postDetail ?: return
        if (detail.post.postType != "question" || detail.post.authorId != _state.value.profile?.id) { _state.update { it.copy(error = "قبول الإجابة متاح لصاحب السؤال فقط") }; return }
        viewModelScope.launch { runCatching { repository.acceptPostAnswer(detail.post.id, commentId); repository.loadPostDetail(detail.post.id) }
            .onSuccess { refreshed -> _state.update { it.copy(postDetail = refreshed, notice = "تم تحديث الإجابة المعتمدة") } }
            .onFailure { e -> _state.update { it.copy(error = e.message ?: "تعذّر اعتماد الإجابة") } } }
    }
    fun deletePostComment(commentId: String) {
        val comment = _state.value.postDetail?.comments?.firstOrNull { it.id == commentId } ?: return
        val profile = _state.value.profile
        if (comment.authorId != profile?.id && profile?.roles?.contains("admin") != true) { _state.update { it.copy(error = "لا تملك صلاحية حذف هذا التعليق") }; return }
        val postId = _state.value.postDetail?.post?.id ?: return
        viewModelScope.launch { runCatching { repository.deletePostComment(commentId); repository.loadPostDetail(postId) }
            .onSuccess { refreshed -> _state.update { it.copy(postDetail = refreshed, notice = "تم حذف التعليق") } }
            .onFailure { e -> _state.update { it.copy(error = e.message ?: "تعذّر حذف التعليق") } } }
    }
    fun backToFeed() { _state.update { it.copy(screen = AppScreen.FEED, postDetail = null) }; loadFeed() }

    fun showSavedPosts() { _state.update { it.copy(screen = AppScreen.SAVED, error = null, loading = true) }; loadSavedPosts() }
    fun loadSavedPosts() { viewModelScope.launch { runCatching { repository.loadFeed(true) }.onSuccess { rows -> _state.update { it.copy(feedPosts = rows, loading = false) } }.onFailure { e -> _state.update { it.copy(loading = false, error = e.message) } } } }
    fun showNotifications() { _state.update { it.copy(screen = AppScreen.NOTIFICATIONS, error = null) }; loadNotifications() }
    fun loadNotifications() { viewModelScope.launch { _state.update { it.copy(notificationsLoading = true) }; runCatching { repository.loadNotifications() }.onSuccess { rows -> _state.update { it.copy(notifications = rows, notificationsLoading = false) } }.onFailure { e -> _state.update { it.copy(notificationsLoading = false, error = e.message) } } } }
    fun readNotification(id: String) { viewModelScope.launch { runCatching { repository.markNotificationRead(id); repository.loadNotifications() }.onSuccess { rows -> _state.update { it.copy(notifications = rows) } }.onFailure { e -> _state.update { it.copy(error = e.message) } } } }
    fun deleteNotification(id: String) { viewModelScope.launch { runCatching { repository.deleteNotification(id); repository.loadNotifications() }.onSuccess { rows -> _state.update { it.copy(notifications = rows) } }.onFailure { e -> _state.update { it.copy(error = e.message) } } } }

    fun showLeaderboard() { _state.update { it.copy(screen = AppScreen.LEADERBOARD, error = null) }; loadLeaderboard() }

    fun loadLeaderboard(timeframe: String = "all", major: String? = null, year: Int? = null) {
        viewModelScope.launch {
            _state.update { it.copy(leaderboardLoading = true, error = null) }
            runCatching { repository.loadLeaderboard(timeframe, major, year) }
                .onSuccess { rows -> _state.update { it.copy(leaderboard = rows, leaderboardLoading = false) } }
                .onFailure { error -> _state.update { it.copy(leaderboardLoading = false, error = error.message ?: "تعذّر تحميل لوحة الصدارة") } }
        }
    }

    fun showCourses() { _state.update { it.copy(screen = AppScreen.COURSES, error = null) }; loadHome() }
    fun showHome() { showFeed() }
    fun showProfile() { _state.update { it.copy(screen = AppScreen.PROFILE, error = null) } }

    fun openCourse(course: Course) {
        _state.update { it.copy(previousScreen = it.screen, screen = AppScreen.COURSE_DETAIL, selectedCourse = course, courseDetail = null, selectedTab = CourseTab.FILES, detailLoading = true, error = null) }
        viewModelScope.launch {
            try {
                val detail = repository.loadCourseDetail(course.id)
                _state.update { it.copy(courseDetail = detail, selectedCourse = detail.course, detailLoading = false) }
            } catch (error: Exception) {
                _state.update { it.copy(detailLoading = false, error = error.message ?: "تعذّر تحميل المقرر") }
            }
        }
    }

    fun backFromCourse() {
        _state.update { it.copy(screen = it.previousScreen, selectedCourse = null, courseDetail = null, error = null) }
    }

    fun selectCourseTab(tab: CourseTab) { _state.update { it.copy(selectedTab = tab) } }

    fun postQuestion(courseId: String, content: String, anonymous: Boolean) {
        if (content.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                repository.postQuestion(courseId, content, anonymous)
                val detail = repository.loadCourseDetail(courseId)
                _state.update { it.copy(busy = false, courseDetail = detail, notice = "تم نشر سؤالك") }
            } catch (error: Exception) {
                _state.update { it.copy(busy = false, error = error.message ?: "تعذّر نشر السؤال") }
            }
        }
    }

    fun addComment(courseId: String, postId: String, content: String) {
        if (content.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                repository.addComment(postId, content)
                val detail = repository.loadCourseDetail(courseId)
                _state.update { it.copy(busy = false, courseDetail = detail, notice = "تم إرسال الرد") }
            } catch (error: Exception) {
                _state.update { it.copy(busy = false, error = error.message ?: "تعذّر إرسال الرد") }
            }
        }
    }

    fun openMaterial(material: CourseMaterial) {
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                val url = repository.resolveMaterialUrl(material)
                _state.update { it.copy(busy = false, pendingUrl = url) }
            } catch (error: Exception) {
                _state.update { it.copy(busy = false, error = error.message ?: "تعذّر فتح المادة") }
            }
        }
    }

    fun clearPendingUrl() { _state.update { it.copy(pendingUrl = null) } }

    fun recoverPassword(identifier: String) {
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null, notice = null) }
            try {
                repository.recoverPassword(identifier)
                _state.update { it.copy(busy = false, notice = "إذا كان الحساب مسجلاً، فسيصلك رابط استعادة كلمة المرور.") }
            } catch (error: Exception) {
                _state.update { it.copy(busy = false, error = error.message ?: "تعذّر إرسال رابط الاستعادة") }
            }
        }
    }

    fun changePassword(password: String) {
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                repository.updatePassword(password)
                _state.update { it.copy(busy = false, screen = AppScreen.PROFILE, notice = "تم تحديث كلمة المرور") }
            } catch (error: Exception) {
                _state.update { it.copy(busy = false, error = error.message ?: "تعذّر تحديث كلمة المرور") }
            }
        }
    }

    fun showChangePassword() { _state.update { it.copy(screen = AppScreen.CHANGE_PASSWORD, error = null) } }
    fun backFromPassword() { _state.update { it.copy(screen = AppScreen.PROFILE, error = null) } }
    fun setThemeMode(mode: ThemeMode) { repository.saveThemeMode(mode); _state.update { it.copy(themeMode = mode) } }
    fun clearMessages() { _state.update { it.copy(error = null, notice = null) } }

    fun signOut() {
        viewModelScope.launch {
            _state.update { it.copy(busy = true) }
            runCatching { repository.signOut() }
            _state.value = NexusUiState(themeMode = repository.loadThemeMode(), loading = false)
        }
    }
}
