package com.nexus.app.ui

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

private val SplashInk = Color(0xFF0F0B1A)
private val Violet300 = Color(0xFFB79CFF)
private val Violet400 = Color(0xFF9B7BFF)
private val Violet500 = Color(0xFF7C4DFF)
private val Violet600 = Color(0xFF5B2BD6)
private val Violet800 = Color(0xFF34128F)

/**
 * Launch moment: an original N built from three ribbons (left stem, diagonal, right stem) that
 * draw in sequence, then a soft violet bloom and the wordmark. No spinner and no artificial
 * delay: the screen is simply swapped out as soon as the session is restored. When the system
 * animation scale is 0 the finished mark is shown immediately.
 */
@Composable
fun NexusSplashScreen() {
    val context = LocalContext.current
    val reduceMotion = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
    val draw = remember { Animatable(if (reduceMotion) 1f else 0f) }
    val bloom = remember { Animatable(if (reduceMotion) 1f else 0f) }
    val label = remember { Animatable(if (reduceMotion) 1f else 0f) }

    LaunchedEffect(Unit) {
        if (!reduceMotion) {
            draw.animateTo(1f, tween(durationMillis = 950, easing = LinearEasing))
            launch { bloom.animateTo(1f, tween(durationMillis = 420, easing = FastOutSlowInEasing)) }
            label.animateTo(1f, tween(durationMillis = 380, easing = FastOutSlowInEasing))
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(SplashInk)
            .semantics { contentDescription = "NEXUS" }
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val h = size.minDimension * 0.30f
            val w = h * 0.74f
            val stem = w * 0.27f
            val left = (size.width - w) / 2f
            val top = size.height * 0.40f - h / 2f
            val bottom = top + h
            val center = Offset(size.width / 2f, top + h / 2f)

            val p = draw.value
            val leftP = (p / 0.36f).coerceIn(0f, 1f)
            val diagP = ((p - 0.24f) / 0.44f).coerceIn(0f, 1f)
            val rightP = ((p - 0.58f) / 0.36f).coerceIn(0f, 1f)

            if (bloom.value > 0f) {
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Violet500.copy(alpha = 0.36f * bloom.value), Color.Transparent),
                        center = center,
                        radius = h * 1.55f
                    ),
                    radius = h * 1.55f,
                    center = center
                )
            }

            val stemBrush = Brush.verticalGradient(listOf(Violet600, Violet800), startY = top, endY = bottom)

            // Left stem grows upward from the baseline.
            clipRect(left = left, top = bottom - h * leftP, right = left + stem, bottom = bottom) {
                drawRect(brush = stemBrush, topLeft = Offset(left, top), size = Size(stem, h))
            }
            // Right stem is drawn downward from the cap line.
            clipRect(left = left + w - stem, top = top, right = left + w, bottom = top + h * rightP) {
                drawRect(brush = stemBrush, topLeft = Offset(left + w - stem, top), size = Size(stem, h))
            }
            // Diagonal ribbon sweeps from top-left to bottom-right, brighter than the stems.
            val diagonal = Path().apply {
                moveTo(left, top)
                lineTo(left + stem, top)
                lineTo(left + w, bottom)
                lineTo(left + w - stem, bottom)
                close()
            }
            clipRect(left = left, top = top, right = left + w, bottom = top + h * diagP) {
                drawPath(
                    path = diagonal,
                    brush = Brush.linearGradient(
                        colors = listOf(Violet300, Violet400, Violet500),
                        start = Offset(left, top),
                        end = Offset(left + w, bottom)
                    )
                )
            }
        }

        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.weight(0.60f))
            Text(
                text = "NEXUS",
                color = Color.White,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 9.sp,
                modifier = Modifier.graphicsLayer {
                    alpha = label.value
                    translationY = (1f - label.value) * 14.dp.toPx()
                }
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "مساحتك الأكاديمية",
                color = Violet300,
                fontSize = 14.sp,
                modifier = Modifier.graphicsLayer {
                    alpha = label.value
                    translationY = (1f - label.value) * 14.dp.toPx()
                }
            )
            Spacer(Modifier.weight(0.40f))
        }
    }
}
