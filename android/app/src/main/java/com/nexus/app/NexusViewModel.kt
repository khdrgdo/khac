package com.nexus.app

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.data.AppScreen
import com.nexus.app.data.Course
import com.nexus.app.data.CourseMaterial
import com.nexus.app.data.CourseTab
import com.nexus.app.data.FeedReaction
import com.nexus.app.data.NexusRepository
import com.nexus.app.data.NexusUiState
import com.nexus.app.data.ThemeMode
import com.nexus.app.data.ProfileThemeRules
import com.nexus.app.data.AppRole
import com.nexus.app.data.AdminTab
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class NexusViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = NexusRepository(application)
    private val postImageUrlCache = mutableMapOf<String, String>()
    private val _state = MutableStateFlow(NexusUiState(themeMode = repository.loadThemeMode()))
    val state: StateFlow<NexusUiState> = _state.asStateFlow()

    fun start(uri: Uri?) {
        if (uri != null) repository.acceptDeepLink(uri)
        if (_state.value.profile != null && uri == null) return
        _state.update { it.copy(busy = false, loading = true, profile = null, profileStats = null, error = null) }
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
                    refreshProfileStats(profile.id)
                    loadFeed()
                    loadRole()
                    refreshUnreadBadges()
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
                refreshProfileStats(profile.id)
                loadFeed()
                loadRole()
                refreshUnreadBadges()
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
        loadFeed(_state.value.feedFilter, _state.value.feedTag)
    }

    fun loadFeed(filter: String = "all", tag: String? = null) {
        viewModelScope.launch {
            val hasCachedPosts = _state.value.feedPosts.isNotEmpty()
            _state.update { it.copy(loading = !hasCachedPosts, error = null, feedFilter = filter, feedTag = tag) }
            try {
                val posts = repository.loadFeed(filter, tag)
                _state.update { it.copy(loading = false, feedPosts = posts, feedFilter = filter, feedTag = tag) }
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message ?: "تعذّر تحميل المنشورات") }
            }
        }
    }

    fun publishPost(content: String, anonymous: Boolean, question: Boolean, imageUris: List<Uri>) {
        if (content.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            val uploadedPaths = mutableListOf<String>()
            var postCreated = false
            try {
                imageUris.take(4).forEach { uri -> uploadedPaths += repository.uploadPostImage(uri) }
                repository.createFeedPost(content, anonymous, question, uploadedPaths)
                postCreated = true
                val current = _state.value
                val posts = repository.loadFeed(current.feedFilter, current.feedTag)
                _state.update { it.copy(busy = false, feedPosts = posts, notice = "تم نشر مساهمتك") }
            } catch (error: Exception) {
                if (!postCreated) uploadedPaths.forEach { path -> runCatching { repository.removePostImage(path) } }
                _state.update {
                    if (postCreated) it.copy(busy = false, notice = "تم نشر المساهمة، لكن تعذّر تحديث الخلاصة. اسحب للتحديث.")
                    else it.copy(busy = false, error = error.message ?: "تعذّر نشر المساهمة")
                }
            }
        }
    }

    fun addFeedComment(postId: String, content: String, parentId: String? = null) {
        if (content.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                repository.addComment(postId, content, parentId)
                val current = _state.value
                val refreshed = repository.loadFeed(current.feedFilter, current.feedTag)
                _state.update {
                    it.copy(busy = false, feedPosts = refreshed, notice = if (parentId == null) "تم إرسال تعليقك" else "تم إرسال ردك")
                }
            } catch (error: Exception) {
                _state.update { it.copy(busy = false, error = error.message ?: "تعذّر إرسال التعليق") }
            }
        }
    }

    fun reactToPost(postId: String, reaction: String?) {
        val userId = _state.value.profile?.id ?: return
        val previous = _state.value.feedPosts.firstOrNull { it.id == postId } ?: return
        val updatedReactions = previous.reactions.filterNot { it.userId == userId } +
            if (reaction == null) emptyList() else listOf(FeedReaction(userId, reaction))
        _state.update {
            it.copy(feedPosts = it.feedPosts.map { post ->
                if (post.id == postId) post.copy(reactions = updatedReactions, myReaction = reaction) else post
            })
        }
        viewModelScope.launch {
            try {
                repository.setPostReaction(postId, reaction)
            } catch (error: Exception) {
                loadFeed(_state.value.feedFilter, _state.value.feedTag)
                _state.update { it.copy(error = error.message ?: "تعذّر حفظ التفاعل") }
            }
        }
    }

    fun toggleSavedPost(postId: String, saved: Boolean) {
        _state.update {
            it.copy(feedPosts = it.feedPosts.map { post -> if (post.id == postId) post.copy(saved = saved) else post })
        }
        viewModelScope.launch {
            try {
                repository.toggleSavedPost(postId, saved)
                _state.update { it.copy(notice = if (saved) "أُضيف المنشور إلى المحفوظات" else "أُزيل من المحفوظات") }
            } catch (error: Exception) {
                loadFeed(_state.value.feedFilter, _state.value.feedTag)
                _state.update { it.copy(error = error.message ?: "تعذّر تحديث المحفوظات") }
            }
        }
    }

    fun deletePost(postId: String) {
        viewModelScope.launch {
            try {
                repository.deletePost(postId)
                _state.update { it.copy(feedPosts = it.feedPosts.filterNot { post -> post.id == postId }, notice = "تم حذف المنشور") }
            } catch (error: Exception) {
                _state.update { it.copy(error = error.message ?: "تعذّر حذف المنشور") }
            }
        }
    }

    fun reportPost(postId: String, reason: String) {
        viewModelScope.launch {
            try {
                repository.reportPost(postId, reason)
                _state.update { it.copy(notice = "تم إرسال البلاغ للمراجعة") }
            } catch (error: Exception) {
                _state.update { it.copy(error = error.message ?: "تعذّر إرسال البلاغ") }
            }
        }
    }

    fun resolvePostImage(path: String, onResult: (String?) -> Unit) {
        postImageUrlCache[path]?.let { onResult(it); return }
        viewModelScope.launch {
            val url = runCatching { repository.resolvePostImageUrl(path) }.getOrNull()
            if (url != null) postImageUrlCache[path] = url
            onResult(url)
        }
    }

    fun showCourses() { _state.update { it.copy(screen = AppScreen.COURSES, error = null) }; loadHome() }
    fun showHome() { showFeed() }
    fun showProfile() { _state.update { it.copy(screen = AppScreen.PROFILE, error = null) } }
    fun openPublicProfile(userId: String) {
        if (userId.isBlank()) return
        _state.update {
            it.copy(
                previousScreen = it.screen,
                screen = AppScreen.PUBLIC_PROFILE,
                publicProfile = null,
                publicProfileStats = null,
                publicProfilePosts = emptyList(),
                publicProfileLoading = true,
                error = null
            )
        }
        viewModelScope.launch {
            try {
                val (profile, posts) = repository.loadPublicProfile(userId)
                if (_state.value.screen == AppScreen.PUBLIC_PROFILE) {
                    _state.update {
                        it.copy(
                            publicProfile = profile,
                            publicProfilePosts = posts,
                            publicProfileStats = ProfileStats(
                                posts = posts.size,
                                comments = posts.sumOf { post -> post.commentsCount },
                                acceptedAnswers = posts.count { post -> post.acceptedAnswerId != null }
                            ),
                            publicProfileLoading = false,
                            error = if (profile == null) "تعذّر العثور على الملف الشخصي" else null
                        )
                    }
                }
            } catch (error: Exception) {
                _state.update { it.copy(publicProfileLoading = false, error = error.message ?: "تعذّر تحميل الملف الشخصي") }
            }
        }
    }


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

    private fun refreshProfileStats(userId: String) {
        viewModelScope.launch {
            val stats = runCatching { repository.loadProfileStats(userId) }.getOrNull()
            _state.update { it.copy(profileStats = stats) }
        }
    }

    fun refreshProfile() {
        val userId = _state.value.profile?.id ?: return
        viewModelScope.launch {
            try {
                val profile = repository.restoreSession() ?: return@launch
                val stats = runCatching { repository.loadProfileStats(userId) }.getOrNull()
                _state.update { it.copy(profile = profile, profileStats = stats, error = null) }
            } catch (error: Exception) {
                _state.update { it.copy(error = error.message ?: "تعذّر تحديث الملف الشخصي") }
            }
        }
    }

    fun updateProfileBio(bio: String) {
        val profile = _state.value.profile ?: return
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                repository.updateProfileBio(profile.id, bio)
                val updated = repository.restoreSession() ?: profile
                _state.update { it.copy(profile = updated, busy = false, notice = "تم تحديث النبذة") }
            } catch (error: Exception) {
                _state.update { it.copy(busy = false, error = error.message ?: "تعذّر تحديث النبذة") }
            }
        }
    }

    fun changeProfileName(name: String, reason: String, contactInfo: String) {
        val profile = _state.value.profile ?: return
        val trimmed = name.trim()
        if (trimmed.length < 2) {
            _state.update { it.copy(error = "الاسم يجب أن يتكون من حرفين على الأقل") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                if (!profile.hasUsedDirectNameChange) {
                    repository.updateProfileName(profile.id, trimmed)
                    val updated = repository.restoreSession() ?: profile.copy(fullName = trimmed, hasUsedDirectNameChange = true)
                    _state.update { it.copy(profile = updated, busy = false, notice = "تم تغيير الاسم. التغييرات التالية تتطلب مراجعة الإدارة.") }
                } else {
                    if (reason.isBlank() || contactInfo.isBlank()) throw IllegalArgumentException("أدخل سبب الطلب ومعلومات التواصل")
                    repository.submitNameChangeRequest(profile.id, profile.fullName, trimmed, reason, contactInfo, profile.universityNumber)
                    _state.update { it.copy(busy = false, notice = "تم إرسال طلب تغيير الاسم إلى الإدارة") }
                }
            } catch (error: Exception) {
                _state.update { it.copy(busy = false, error = error.message ?: "تعذّر تغيير الاسم") }
            }
        }
    }

    fun toggleUniversityNumberPrivacy(hidden: Boolean) {
        val profile = _state.value.profile ?: return
        viewModelScope.launch {
            try {
                repository.toggleUniversityNumberPrivacy(profile.id, hidden)
                _state.update { it.copy(profile = it.profile?.copy(hideUniversityNumber = hidden), notice = if (hidden) "تم إخفاء الرقم الجامعي" else "تم إظهار الرقم الجامعي") }
            } catch (error: Exception) {
                _state.update { it.copy(error = error.message ?: "تعذّر تحديث الخصوصية") }
            }
        }
    }

    fun uploadProfileAvatar(uri: Uri) {
        val profile = _state.value.profile ?: return
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                repository.uploadProfileAvatar(uri, profile.id)
                val updated = repository.restoreSession() ?: profile
                _state.update { it.copy(profile = updated, busy = false, notice = "تم تحديث الصورة الشخصية") }
            } catch (error: Exception) {
                _state.update { it.copy(busy = false, error = error.message ?: "تعذّر تحديث الصورة") }
            }
        }
    }

    fun showChangePassword() { _state.update { it.copy(screen = AppScreen.CHANGE_PASSWORD, error = null) } }
    fun backFromPassword() { _state.update { it.copy(screen = AppScreen.PROFILE, error = null) } }
    fun setThemeMode(mode: ThemeMode) { repository.saveThemeMode(mode); _state.update { it.copy(themeMode = mode) } }

    fun saveProfileCardTheme(themeId: String) {
        val profile = _state.value.profile ?: return
        if (!ProfileThemeRules.isUnlocked(profile.points, themeId)) {
            _state.update { it.copy(error = "لم تصل بعد إلى النقاط المطلوبة لهذا المظهر") }
            return
        }
        viewModelScope.launch {
            try {
                repository.saveProfileCardTheme(themeId)
                _state.update { it.copy(profile = it.profile?.copy(cardThemeId = themeId), notice = "تم تحديث مظهر بطاقتك") }
            } catch (error: Exception) {
                _state.update { it.copy(error = error.message ?: "تعذّر حفظ مظهر البطاقة") }
            }
        }
    }
    fun clearMessages() { _state.update { it.copy(error = null, notice = null) } }

    fun signOut() {
        viewModelScope.launch {
            _state.update { it.copy(busy = true) }
            runCatching { repository.signOut() }
            _state.value = NexusUiState(themeMode = repository.loadThemeMode(), loading = false)
        }
    }

    // ---------------------------------------------------------------------
    // Role + unread badges
    // ---------------------------------------------------------------------
    private fun loadRole() {
        viewModelScope.launch {
            val role = runCatching { repository.loadRole() }.getOrDefault(AppRole.UNKNOWN)
            _state.update { it.copy(role = role) }
        }
    }

    private fun refreshUnreadBadges() {
        viewModelScope.launch {
            runCatching { repository.unreadMessageCount() }.getOrNull()?.let { count ->
                _state.update { it.copy(messaging = it.messaging.copy(unreadTotal = count)) }
            }
        }
        viewModelScope.launch {
            runCatching { repository.loadNotifications() }.getOrNull()?.let { ns ->
                _state.update { it.copy(notifications = ns) }
            }
        }
    }

    // ---------------------------------------------------------------------
    // Messaging
    // ---------------------------------------------------------------------
    fun showMessages() {
        _state.update { it.copy(screen = AppScreen.MESSAGES, error = null) }
        viewModelScope.launch {
            _state.update { it.copy(messaging = it.messaging.copy(loading = true)) }
            try {
                val ms = repository.loadConversations()
                _state.update { it.copy(messaging = ms) }
            } catch (error: Exception) {
                _state.update { it.copy(messaging = it.messaging.copy(loading = false), error = error.message ?: "تعذّر تحميل المحادثات") }
            }
        }
    }

    fun openConversation(conversationId: String, otherUserId: String?, title: String) {
        _state.update { it.copy(screen = AppScreen.CONVERSATION, messaging = it.messaging.copy(activeConversationId = conversationId, activeOtherUserId = otherUserId, activeTitle = title, messages = emptyList(), loading = true)) }
        viewModelScope.launch {
            try {
                val messages = repository.loadMessages(conversationId)
                _state.update { it.copy(messaging = it.messaging.copy(messages = messages, loading = false)) }
                runCatching { repository.markConversationRead(conversationId) }
                refreshUnreadBadges()
            } catch (error: Exception) {
                _state.update { it.copy(messaging = it.messaging.copy(loading = false), error = error.message ?: "تعذّر تحميل الرسائل") }
            }
        }
    }

    fun startConversationWith(otherUserId: String, title: String) {
        viewModelScope.launch {
            try {
                val convId = repository.openDirectConversation(otherUserId)
                openConversation(convId, otherUserId, title)
            } catch (error: Exception) {
                _state.update { it.copy(error = error.message ?: "تعذّر بدء المحادثة") }
            }
        }
    }

    fun sendMessage(text: String) {
        val convId = _state.value.messaging.activeConversationId ?: return
        if (text.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(messaging = it.messaging.copy(sending = true)) }
            try {
                repository.sendMessage(convId, text)
                val messages = repository.loadMessages(convId)
                _state.update { it.copy(messaging = it.messaging.copy(messages = messages, sending = false)) }
            } catch (error: Exception) {
                _state.update { it.copy(messaging = it.messaging.copy(sending = false), error = error.message ?: "تعذّر إرسال الرسالة") }
            }
        }
    }

    fun setConversationBlocked(blocked: Boolean) {
        val otherId = _state.value.messaging.activeOtherUserId ?: return
        viewModelScope.launch {
            try {
                repository.setUserBlocked(otherId, blocked)
                _state.update { it.copy(notice = if (blocked) "تم حظر المستخدم" else "تم إلغاء الحظر") }
                showMessages()
            } catch (error: Exception) {
                _state.update { it.copy(error = error.message ?: "تعذّر تحديث الحظر") }
            }
        }
    }

    fun leaveActiveConversation() {
        val convId = _state.value.messaging.activeConversationId ?: return
        viewModelScope.launch {
            try {
                repository.leaveConversation(convId)
                showMessages()
                _state.update { it.copy(notice = "تمت مغادرة المحادثة") }
            } catch (error: Exception) {
                _state.update { it.copy(error = error.message ?: "تعذّرت مغادرة المحادثة") }
            }
        }
    }

    fun reportActiveConversation(reason: String, note: String?) {
        val convId = _state.value.messaging.activeConversationId ?: return
        val otherId = _state.value.messaging.activeOtherUserId ?: return
        viewModelScope.launch {
            try {
                repository.reportMessageThread(convId, otherId, reason, note)
                _state.update { it.copy(notice = "تم إرسال البلاغ للمراجعة") }
            } catch (error: Exception) {
                _state.update { it.copy(error = error.message ?: "تعذّر إرسال البلاغ") }
            }
        }
    }

    fun backFromConversation() { showMessages() }

    // ---------------------------------------------------------------------
    // Notifications
    // ---------------------------------------------------------------------
    fun showNotifications() {
        _state.update { it.copy(screen = AppScreen.NOTIFICATIONS, error = null) }
        viewModelScope.launch {
            _state.update { it.copy(notifications = it.notifications.copy(loading = true)) }
            try {
                val ns = repository.loadNotifications()
                _state.update { it.copy(notifications = ns) }
            } catch (error: Exception) {
                _state.update { it.copy(notifications = it.notifications.copy(loading = false), error = error.message ?: "تعذّر تحميل الإشعارات") }
            }
        }
    }

    fun openNotification(id: String) {
        viewModelScope.launch {
            runCatching { repository.markNotificationRead(id) }
            _state.update { s -> s.copy(notifications = s.notifications.copy(items = s.notifications.items.map { if (it.id == id) it.copy(read = true) else it }, unreadCount = (s.notifications.unreadCount - 1).coerceAtLeast(0))) }
        }
    }

    fun markAllNotificationsRead() {
        viewModelScope.launch {
            runCatching { repository.markAllNotificationsRead() }
            _state.update { s -> s.copy(notifications = s.notifications.copy(items = s.notifications.items.map { it.copy(read = true) }, unreadCount = 0)) }
        }
    }

    // ---------------------------------------------------------------------
    // Search
    // ---------------------------------------------------------------------
    fun showSearch() { _state.update { it.copy(screen = AppScreen.SEARCH, error = null) } }

    fun updateSearchQuery(query: String) {
        _state.update { it.copy(search = it.search.copy(query = query)) }
        if (query.trim().length < 2) {
            _state.update { it.copy(search = it.search.copy(results = com.nexus.app.data.SearchResults())) }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(search = it.search.copy(loading = true)) }
            try {
                val results = repository.search(query)
                if (_state.value.search.query == query) {
                    _state.update { it.copy(search = it.search.copy(results = results, loading = false, recent = (listOf(query) + it.search.recent).distinct().take(8))) }
                }
            } catch (error: Exception) {
                _state.update { it.copy(search = it.search.copy(loading = false)) }
            }
        }
    }

    // ---------------------------------------------------------------------
    // Leaderboard
    // ---------------------------------------------------------------------
    fun showLeaderboard() {
        _state.update { it.copy(screen = AppScreen.LEADERBOARD, error = null) }
        loadLeaderboard(null, null)
    }

    fun loadLeaderboard(major: String?, year: Int?) {
        viewModelScope.launch {
            _state.update { it.copy(leaderboard = it.leaderboard.copy(loading = true, major = major, year = year)) }
            try {
                val entries = repository.loadLeaderboard(major, year)
                val mine = entries.firstOrNull { it.id == _state.value.profile?.id }
                _state.update { it.copy(leaderboard = it.leaderboard.copy(entries = entries, myRank = mine, loading = false)) }
            } catch (error: Exception) {
                _state.update { it.copy(leaderboard = it.leaderboard.copy(loading = false), error = error.message ?: "تعذّر تحميل لوحة الصدارة") }
            }
        }
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------
    fun showAdmin() {
        if (_state.value.role != AppRole.ADMIN && _state.value.role != AppRole.SUB_ADMIN) {
            _state.update { it.copy(error = "لا تملك صلاحية الوصول إلى لوحة الإدارة") }
            return
        }
        _state.update { it.copy(screen = AppScreen.ADMIN, error = null) }
        loadAdminOverview()
    }

    fun setAdminTab(tab: AdminTab) {
        _state.update { it.copy(admin = it.admin.copy(tab = tab)) }
        when (tab) {
            AdminTab.OVERVIEW -> loadAdminOverview()
            AdminTab.USERS -> loadAdminUsers()
            AdminTab.REPORTS -> loadAdminReports()
            AdminTab.WORDS -> loadAdminWords()
            AdminTab.ACTIVITY -> loadAdminActivity()
            else -> Unit // Tabs without an Android implementation are not exposed by AdminScreen.
        }
    }

    private fun loadAdminOverview() {
        viewModelScope.launch {
            _state.update { it.copy(admin = it.admin.copy(loading = true)) }
            try {
                val stats = repository.loadAdminStats()
                _state.update { it.copy(admin = it.admin.copy(stats = stats, loading = false)) }
            } catch (error: Exception) {
                _state.update { it.copy(admin = it.admin.copy(loading = false), error = error.message ?: "تعذّر تحميل الإحصائيات") }
            }
        }
    }

    private fun loadAdminUsers() {
        viewModelScope.launch {
            _state.update { it.copy(admin = it.admin.copy(loading = true)) }
            try {
                val users = repository.loadAdminUsers()
                _state.update { it.copy(admin = it.admin.copy(users = users, loading = false)) }
            } catch (error: Exception) {
                _state.update { it.copy(admin = it.admin.copy(loading = false), error = error.message ?: "تعذّر تحميل المستخدمين") }
            }
        }
    }

    private fun loadAdminReports() {
        viewModelScope.launch {
            _state.update { it.copy(admin = it.admin.copy(loading = true)) }
            try {
                val posts = repository.loadPostReports()
                val messages = repository.loadMessageReports()
                _state.update { it.copy(admin = it.admin.copy(postReports = posts, messageReports = messages, loading = false)) }
            } catch (error: Exception) {
                _state.update { it.copy(admin = it.admin.copy(loading = false), error = error.message ?: "تعذّر تحميل البلاغات") }
            }
        }
    }

    private fun loadAdminWords() {
        viewModelScope.launch {
            try {
                val words = repository.loadBannedWords()
                _state.update { it.copy(admin = it.admin.copy(bannedWords = words)) }
            } catch (error: Exception) { }
        }
    }

    private fun loadAdminActivity() {
        viewModelScope.launch {
            try {
                val activity = repository.loadRecentAdminActivity()
                _state.update { it.copy(admin = it.admin.copy(activity = activity)) }
            } catch (error: Exception) { }
        }
    }

    private fun runAdminAction(block: suspend () -> Unit) {
        viewModelScope.launch {
            try {
                block()
                _state.update { it.copy(notice = "تم تنفيذ الإجراء") }
                setAdminTab(_state.value.admin.tab)
            } catch (error: Exception) {
                _state.update { it.copy(error = error.message ?: "تعذّر تنفيذ الإجراء") }
            }
        }
    }

    fun adminSetRole(userId: String, role: String) = runAdminAction { repository.adminSetRole(userId, role) }
    fun adminBan(userId: String, reason: String) = runAdminAction { repository.adminBan(userId, reason) }
    fun adminUnban(userId: String) = runAdminAction { repository.adminUnban(userId) }
    fun adminSuspend(userId: String, days: Int, reason: String) = runAdminAction { repository.adminSuspend(userId, days, reason) }
    fun adminWarn(userId: String, reason: String) = runAdminAction { repository.adminWarn(userId, reason) }
    fun adminSetVerified(userId: String, verified: Boolean) = runAdminAction { repository.adminSetVerified(userId, verified) }
    fun adminAdjustPoints(userId: String, delta: Int) = runAdminAction { repository.adminAdjustPoints(userId, delta) }
    fun adminDeleteUser(userId: String) = runAdminAction { repository.adminDeleteUser(userId) }
    fun adminSetTeacherRole(userId: String) = runAdminAction { repository.adminSetTeacherRole(userId) }
    fun adminDismissPostReport(id: String) = runAdminAction { repository.dismissPostReport(id) }
    fun adminDismissMessageReport(id: String) = runAdminAction { repository.dismissMessageReport(id) }
    fun adminDeletePost(postId: String, reportId: String) = runAdminAction { repository.deletePostAsAdmin(postId); repository.dismissPostReport(reportId) }
    fun adminAddBannedWord(word: String) = runAdminAction { repository.addBannedWord(word) }
    fun adminRemoveBannedWord(id: String) = runAdminAction { repository.removeBannedWord(id) }

}
