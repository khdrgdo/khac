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

private val Ink = Color(0xFF24354B)
private val InkDeep = Color(0xFF182638)
private val Ivory = Color(0xFFF6F4EF)
private val Paper = Color(0xFFFFFEFB)
private val Gold = Color(0xFFC49A58)
private val MutedGreen = Color(0xFF66847F)
private val TextMuted = Color(0xFF6C7480)
private val BorderLight = Color(0xFFE4E0D8)
private val Night = Color(0xFF151F2D)
private val NightSurface = Color(0xFF202D3E)
private val NightBorder = Color(0xFF354354)
private val SoftGold = Color(0xFFD6B878)
private val SoftGreen = Color(0xFF9AB8B0)

private val LightColors = lightColorScheme(
    primary = Ink,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE6EAF0),
    onPrimaryContainer = InkDeep,
    secondary = MutedGreen,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFE3ECE9),
    onSecondaryContainer = Color(0xFF29433F),
    tertiary = Gold,
    onTertiary = InkDeep,
    background = Ivory,
    onBackground = InkDeep,
    surface = Paper,
    onSurface = InkDeep,
    surfaceVariant = Color(0xFFEDEAE4),
    onSurfaceVariant = TextMuted,
    outline = BorderLight,
    outlineVariant = Color(0xFFECE8E0),
    error = Color(0xFFB64242),
    onError = Color.White
)

private val DarkColors = darkColorScheme(
    primary = SoftGold,
    onPrimary = InkDeep,
    primaryContainer = Color(0xFF3A3A38),
    onPrimaryContainer = Color(0xFFF4E7C8),
    secondary = SoftGreen,
    onSecondary = Night,
    secondaryContainer = Color(0xFF2D4442),
    onSecondaryContainer = Color(0xFFD4E4DF),
    tertiary = SoftGold,
    onTertiary = Night,
    background = Night,
    onBackground = Color(0xFFF1F0EC),
    surface = NightSurface,
    onSurface = Color(0xFFF1F0EC),
    surfaceVariant = Color(0xFF2B394A),
    onSurfaceVariant = Color(0xFFB6BEC8),
    outline = NightBorder,
    outlineVariant = Color(0xFF2B394A),
    error = Color(0xFFFF8A80),
    onError = Color(0xFF3B1111)
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
