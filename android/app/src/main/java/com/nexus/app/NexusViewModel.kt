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
            try {
                imageUris.take(4).forEach { uri -> uploadedPaths += repository.uploadPostImage(uri) }
                repository.createFeedPost(content, anonymous, question, uploadedPaths)
                val current = _state.value
                val posts = repository.loadFeed(current.feedFilter, current.feedTag)
                _state.update { it.copy(busy = false, feedPosts = posts, notice = "تم نشر مساهمتك") }
            } catch (error: Exception) {
                uploadedPaths.forEach { path -> runCatching { repository.removePostImage(path) } }
                _state.update { it.copy(busy = false, error = error.message ?: "تعذّر نشر المساهمة") }
            }
        }
    }

    fun addFeedComment(postId: String, content: String) {
        if (content.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                repository.addComment(postId, content)
                _state.update {
                    it.copy(
                        busy = false,
                        feedPosts = it.feedPosts.map { post ->
                            if (post.id == postId) post.copy(commentsCount = post.commentsCount + 1) else post
                        },
                        notice = "تم إرسال تعليقك"
                    )
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
}
