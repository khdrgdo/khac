package com.nexus.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.nexus.app.data.ProfileThemeRules
import com.nexus.app.data.StudentProfile
import com.nexus.app.data.majorLabel

private data class NexusProfileTheme(val id: String, val name: String, val rank: String, val minPoints: Int, val imageUrl: String, val accent: Color)

private val NexusProfileThemes = listOf(
    NexusProfileTheme("stars", "المدار الليلي", "المبتدئ", 0, "https://images.unsplash.com/photo-1522124624696-7ea32eb9592c?auto=format&fit=crop&w=1200&q=80", Color(0xFFE5C58B)),
    NexusProfileTheme("clouds", "السحب الفضية", "الفضي", 100, "https://images.unsplash.com/photo-1627668354740-85b334441b5e?auto=format&fit=crop&w=1200&q=80", Color(0xFF9FC8D7)),
    NexusProfileTheme("moon", "الخسوف", "الذهبي", 300, "https://images.unsplash.com/photo-1606373924807-8a1d7bf1bf31?auto=format&fit=crop&w=1200&q=80", Color(0xFFE3B9A1)),
    NexusProfileTheme("sun", "الشروق", "البلاتيني", 700, "https://images.unsplash.com/photo-1647289491458-2803fbc4499c?auto=format&fit=crop&w=1200&q=80", Color(0xFFF0C27D)),
    NexusProfileTheme("galaxy", "السديم", "الماسي", 1500, "https://images.unsplash.com/photo-1659413151520-bbc015ee3472?auto=format&fit=crop&w=1200&q=80", Color(0xFFB6B8E8))
)

@Composable
fun NexusProfileCard(profile: StudentProfile, onThemeSelected: (String) -> Unit) {
    var pickerOpen by rememberSaveable { mutableStateOf(false) }
    val defaultId = ProfileThemeRules.defaultForPoints(profile.points)
    val selectedTheme = NexusProfileThemes.firstOrNull { it.id == profile.cardThemeId && ProfileThemeRules.isUnlocked(profile.points, it.id) }
        ?: NexusProfileThemes.first { it.id == defaultId }
    val nextTheme = NexusProfileThemes.firstOrNull { it.minPoints > profile.points }
    val progress = if (nextTheme == null) 1f else ((profile.points - selectedTheme.minPoints).toFloat() / (nextTheme.minPoints - selectedTheme.minPoints).toFloat()).coerceIn(0f, 1f)

    Card(modifier = Modifier.fillMaxWidth().height(282.dp), shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFF14212D)), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
        Box(Modifier.fillMaxSize()) {
            AsyncImage(model = selectedTheme.imageUrl, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x440B1420), 0.42f to Color(0x7A0B1420), 1f to Color(0xF20B1420))))
            Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Color(0x220B1420), Color.Transparent, Color(0x440B1420)))))
            Column(Modifier.fillMaxSize().padding(18.dp), verticalArrangement = Arrangement.SpaceBetween) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("NEXUS / STUDENT CARD", color = Color.White.copy(alpha = 0.76f), fontSize = 9.sp, letterSpacing = 2.2.sp, fontWeight = FontWeight.SemiBold)
                        Text(selectedTheme.name, color = Color.White, style = MaterialTheme.typography.titleMedium)
                    }
                    Surface(color = selectedTheme.accent.copy(alpha = 0.18f), shape = RoundedCornerShape(20.dp)) {
                        Text(selectedTheme.rank, color = Color.White, modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp), style = MaterialTheme.typography.labelMedium)
                    }
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(62.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.16f))) {
                        if (!profile.avatarUrl.isNullOrBlank()) AsyncImage(model = profile.avatarUrl, contentDescription = "الصورة الشخصية", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                        else Text(profile.fullName.take(1).ifBlank { "N" }, modifier = Modifier.align(Alignment.Center), color = Color.White, style = MaterialTheme.typography.headlineMedium)
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(profile.fullName, color = Color.White, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(listOfNotNull(profile.major?.let(::majorLabel), profile.year?.let { "السنة $it" }).joinToString("  •  "), color = Color.White.copy(alpha = 0.76f), style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(profile.universityNumber, color = Color.White.copy(alpha = 0.66f), fontSize = 10.sp, letterSpacing = 1.sp)
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${profile.points} نقطة", color = Color.White, style = MaterialTheme.typography.titleMedium)
                        Text(nextTheme?.let { "المستوى التالي: ${it.name} · ${it.minPoints} نقطة" } ?: "أعلى مستوى", color = Color.White.copy(alpha = 0.72f), style = MaterialTheme.typography.labelSmall)
                    }
                    LinearProgressIndicator(progress = progress, modifier = Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(10.dp)), color = selectedTheme.accent, trackColor = Color.White.copy(alpha = 0.22f))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = { pickerOpen = true }) { Text("تخصيص بطاقة المستوى", color = Color.White, style = MaterialTheme.typography.labelLarge) }
                    }
                }
            }
        }
    }

    if (pickerOpen) {
        AlertDialog(
            onDismissRequest = { pickerOpen = false },
            title = { Text("مظاهر بطاقة المستوى") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    NexusProfileThemes.forEach { theme ->
                        val unlocked = ProfileThemeRules.isUnlocked(profile.points, theme.id)
                        val selected = selectedTheme.id == theme.id
                        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f)).clickable(enabled = unlocked) { onThemeSelected(theme.id); pickerOpen = false }.padding(9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Box(Modifier.size(width = 82.dp, height = 54.dp).clip(RoundedCornerShape(8.dp))) {
                                AsyncImage(model = theme.imageUrl, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                                if (!unlocked) Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.5f)))
                            }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(theme.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                                Text("${theme.rank} · ${theme.minPoints} نقطة", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            if (!unlocked) androidx.compose.material3.Icon(Icons.Outlined.Lock, contentDescription = "مقفل", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            else if (selected) androidx.compose.material3.Icon(Icons.Outlined.Check, contentDescription = "محدد", tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { pickerOpen = false }) { Text("إغلاق") } }
        )
    }
}
