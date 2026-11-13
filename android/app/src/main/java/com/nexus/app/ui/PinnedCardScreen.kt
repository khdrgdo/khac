package com.nexus.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nexus.app.data.PinnedCardConfig
import com.nexus.app.data.StudentProfile
import java.time.Instant

@Composable
fun PinnedEventCard(config: PinnedCardConfig?, profile: StudentProfile?, onVote: (String) -> Unit,
    onParticipate: () -> Unit, onOpenAction: (String) -> Unit) {
    if (config == null || !config.enabled) return
    if (config.targetYear != null && config.targetYear != profile?.year) return
    if (!config.targetMajor.isNullOrBlank() && config.targetMajor != profile?.major) return
    val expired = config.endDate?.let { runCatching { Instant.parse(it).isBefore(Instant.now()) }.getOrDefault(false) } ?: false
    if (expired) return
    val colors = when (config.theme) {
        "emerald" -> listOf(Color(0xFF064E3B), Color(0xFF065F46))
        "amber" -> listOf(Color(0xFF78350F), Color(0xFF92400E))
        "sapphire" -> listOf(Color(0xFF172554), Color(0xFF1E40AF))
        "crimson" -> listOf(Color(0xFF7F1D1D), Color(0xFF991B1B))
        "cyber" -> listOf(Color(0xFF312E81), Color(0xFF701A75))
        else -> listOf(Color(0xFF1E1B4B), Color(0xFF3730A3))
    }
    val myVote = profile?.id?.let { config.votes[it] }
    val actionAllowed = config.type == "poll" || config.type == "contest" || !config.actionButtonUrl.isNullOrBlank()
    Card(shape = RoundedCornerShape(20.dp), elevation = CardDefaults.cardElevation(2.dp)) {
        Column(Modifier.fillMaxWidth().background(Brush.linearGradient(colors)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(color = Color.White.copy(alpha = .15f), shape = RoundedCornerShape(50)) { Text(config.badgeText.ifBlank { "مميز" }, Modifier.padding(horizontal = 10.dp, vertical = 5.dp), color = Color.White, style = MaterialTheme.typography.labelSmall) }
                Spacer(Modifier.weight(1f))
                Text(when(config.type) { "poll" -> "تصويت"; "contest" -> "مسابقة"; "event" -> "فعالية"; else -> "إعلان" }, color = Color.White.copy(alpha=.85f), style = MaterialTheme.typography.labelSmall)
            }
            Text(config.title, color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            if (!config.imageUrl.isNullOrBlank()) AsyncImage(config.imageUrl, "صورة الفعالية", Modifier.fillMaxWidth().heightIn(max = 190.dp).clip(RoundedCornerShape(14.dp)))
            if (config.description.isNotBlank()) Text(config.description, color = Color.White.copy(alpha = .9f), style = MaterialTheme.typography.bodyMedium)
            when (config.type) {
                "poll" -> {
                    config.pollOptions.forEach { option ->
                        val count = config.votes.values.count { it == option.id }
                        val selected = myVote == option.id
                        OutlinedButton(onClick = { onVote(option.id) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.outlinedButtonColors(containerColor = if (selected) Color.White.copy(alpha=.22f) else Color.Transparent, contentColor = Color.White)) {
                            Text(option.text, Modifier.weight(1f)); Text("$count")
                        }
                    }
                    Text("${config.votes.size} صوت", color = Color.White.copy(alpha=.8f), style = MaterialTheme.typography.labelSmall)
                }
                "contest" -> {
                    Text("${config.participants.size} مشارك", color = Color.White, style = MaterialTheme.typography.titleMedium)
                    Button(onClick = onParticipate, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = colors.first()), shape = RoundedCornerShape(12.dp)) {
                        Icon(Icons.Outlined.EmojiEvents, null); Spacer(Modifier.width(7.dp)); Text(if (profile?.id?.let { it in config.participants } == true) "إلغاء المشاركة" else "اشترك في المسابقة")
                    }
                }
            }
            if (config.type != "poll" && config.type != "contest" && actionAllowed) {
                Button(onClick = { config.actionButtonUrl?.takeIf(String::isNotBlank)?.let(onOpenAction) }, modifier = Modifier.fillMaxWidth(),
                    enabled = !config.actionButtonUrl.isNullOrBlank(), colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = colors.first())) {
                    Text(config.actionButtonText ?: "اعرف المزيد")
                }
            }
            config.endDate?.let { date -> Text("ينتهي: ${date.take(10)}", color = Color.White.copy(alpha=.7f), style = MaterialTheme.typography.labelSmall) }
        }
    }
}
