package com.nexus.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import com.nexus.app.data.ThemeMode

private val Ink = Color(0xFF172635)
private val InkDeep = Color(0xFF101820)
private val Paper = Color(0xFFF5F2EC)
private val SurfaceLight = Color(0xFFFFFEFB)
private val Terracotta = Color(0xFFB85E42)
private val Teal = Color(0xFF39736E)
private val TextMuted = Color(0xFF66717B)
private val BorderLight = Color(0xFFE1DDD4)
private val Night = Color(0xFF101820)
private val NightSurface = Color(0xFF1B2935)
private val NightBorder = Color(0xFF35434F)
private val SoftCobalt = Color(0xFF91A8FF)
private val SoftTerracotta = Color(0xFFF0A080)
private val SoftTeal = Color(0xFF9CC2B9)

private val LightColors = lightColorScheme(
    primary = Ink, onPrimary = Color.White, primaryContainer = Color(0xFFE3E9F1), onPrimaryContainer = InkDeep,
    secondary = Terracotta, onSecondary = Color.White, secondaryContainer = Color(0xFFF3E3DC), onSecondaryContainer = Color(0xFF592D20),
    tertiary = Teal, onTertiary = Color.White, background = Paper, onBackground = InkDeep,
    surface = SurfaceLight, onSurface = InkDeep, surfaceVariant = Color(0xFFEAE6DE), onSurfaceVariant = TextMuted,
    outline = BorderLight, outlineVariant = Color(0xFFECE8E1), error = Color(0xFFB64242), onError = Color.White
)

private val DarkColors = darkColorScheme(
    primary = SoftCobalt, onPrimary = InkDeep, primaryContainer = Color(0xFF273B63), onPrimaryContainer = Color(0xFFE1E8FF),
    secondary = SoftTerracotta, onSecondary = Night, secondaryContainer = Color(0xFF57382F), onSecondaryContainer = Color(0xFFFFE0D3),
    tertiary = SoftTeal, onTertiary = Night, background = Night, onBackground = Color(0xFFF3F0E9),
    surface = NightSurface, onSurface = Color(0xFFF3F0E9), surfaceVariant = Color(0xFF263744), onSurfaceVariant = Color(0xFFB8C0C7),
    outline = NightBorder, outlineVariant = Color(0xFF2A3945), error = Color(0xFFFF8A80), onError = Color(0xFF3B1111)
)

private val NexusTypography = Typography(
    displayLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 34.sp, lineHeight = 42.sp, letterSpacing = (-0.7).sp),
    headlineLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 36.sp, letterSpacing = (-0.45).sp),
    headlineMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 32.sp),
    titleLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 26.sp),
    titleMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 25.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 22.sp),
    bodySmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Normal, fontSize = 11.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, lineHeight = 18.sp),
    labelMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 16.sp)
)

@Composable
fun NexusTheme(mode: ThemeMode, content: @Composable () -> Unit) {
    val dark = when (mode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(
            colorScheme = if (dark) DarkColors else LightColors,
            typography = NexusTypography,
            content = content
        )
    }
}
