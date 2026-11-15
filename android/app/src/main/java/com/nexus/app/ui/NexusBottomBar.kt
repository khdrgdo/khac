package com.nexus.app.ui

import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nexus.app.data.AppScreen

/** The one bottom bar every root tab shares: Home, Courses, Messages (badge), Profile. */
@Composable
internal fun NexusBottomBar(
    selected: AppScreen,
    unreadMessages: Int,
    onHome: () -> Unit,
    onCourses: () -> Unit,
    onMessages: () -> Unit,
    onProfile: () -> Unit
) {
    NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
        NavigationBarItem(selected == AppScreen.HOME || selected == AppScreen.FEED, onHome, icon = { Icon(Icons.Outlined.Home, null) }, label = { Text("الرئيسية") })
        NavigationBarItem(selected == AppScreen.COURSES, onCourses, icon = { Icon(Icons.Outlined.MenuBook, null) }, label = { Text("المقررات") })
        NavigationBarItem(
            selected == AppScreen.MESSAGES || selected == AppScreen.CONVERSATION,
            onMessages,
            icon = {
                if (unreadMessages > 0) {
                    BadgedBox(badge = { Badge { Text(unreadMessages.coerceAtMost(99).toString()) } }) {
                        Icon(Icons.Outlined.ChatBubbleOutline, null)
                    }
                } else {
                    Icon(Icons.Outlined.ChatBubbleOutline, null)
                }
            },
            label = { Text("الرسائل") }
        )
        NavigationBarItem(selected == AppScreen.PROFILE, onProfile, icon = { Icon(Icons.Outlined.PersonOutline, null) }, label = { Text("حسابي") })
    }
}
