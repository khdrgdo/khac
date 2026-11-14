package com.nexus.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.data.ThemeMode

/** Roles that Material 3 has no slot for: premium/leaderboard gold, reactions, brand gradient. */
@Immutable
data class NexusExtras(
    val gold: Color,
    val onGold: Color,
    val goldContainer: Color,
    val onGoldContainer: Color,
    val success: Color,
    val reaction: Color,
    val reactionContainer: Color,
    val onReactionContainer: Color,
    val surfaceRaised: Color,
    val brandStart: Color,
    val brandEnd: Color
)

private val LightExtras = NexusExtras(
    gold = Color(NexusPalette.Light.Gold), onGold = Color(NexusPalette.Light.OnGold),
    goldContainer = Color(NexusPalette.Light.GoldContainer), onGoldContainer = Color(NexusPalette.Light.OnGoldContainer),
    success = Color(NexusPalette.Light.Teal),
    reaction = Color(NexusPalette.Light.Coral), reactionContainer = Color(NexusPalette.Light.CoralContainer),
    onReactionContainer = Color(NexusPalette.Light.OnCoralContainer),
    surfaceRaised = Color(NexusPalette.Light.SurfaceHigh),
    brandStart = Color(0xFF7C4DFF), brandEnd = Color(0xFF4A1FB8)
)

private val DarkExtras = NexusExtras(
    gold = Color(NexusPalette.Dark.Gold), onGold = Color(NexusPalette.Dark.OnGold),
    goldContainer = Color(NexusPalette.Dark.GoldContainer), onGoldContainer = Color(NexusPalette.Dark.OnGoldContainer),
    success = Color(NexusPalette.Dark.Teal),
    reaction = Color(NexusPalette.Dark.Coral), reactionContainer = Color(NexusPalette.Dark.CoralContainer),
    onReactionContainer = Color(NexusPalette.Dark.OnCoralContainer),
    surfaceRaised = Color(NexusPalette.Dark.SurfaceHigh),
    brandStart = Color(0xFF9B7BFF), brandEnd = Color(0xFF5B2BD6)
)

val LocalNexusExtras = staticCompositionLocalOf { LightExtras }

val MaterialTheme.nexus: NexusExtras
    @Composable @ReadOnlyComposable get() = LocalNexusExtras.current

private val LightColors = lightColorScheme(
    primary = Color(NexusPalette.Light.Primary), onPrimary = Color(NexusPalette.Light.OnPrimary),
    primaryContainer = Color(NexusPalette.Light.PrimaryContainer), onPrimaryContainer = Color(NexusPalette.Light.OnPrimaryContainer),
    inversePrimary = Color(NexusPalette.Dark.Primary),
    secondary = Color(NexusPalette.Light.Secondary), onSecondary = Color(NexusPalette.Light.OnSecondary),
    secondaryContainer = Color(NexusPalette.Light.SecondaryContainer), onSecondaryContainer = Color(NexusPalette.Light.OnSecondaryContainer),
    tertiary = Color(NexusPalette.Light.Teal), onTertiary = Color(NexusPalette.Light.OnTeal),
    tertiaryContainer = Color(NexusPalette.Light.TealContainer), onTertiaryContainer = Color(NexusPalette.Light.OnTealContainer),
    background = Color(NexusPalette.Light.Bg), onBackground = Color(NexusPalette.Light.Text),
    surface = Color(NexusPalette.Light.Surface), onSurface = Color(NexusPalette.Light.Text),
    surfaceVariant = Color(NexusPalette.Light.SurfaceVariant), onSurfaceVariant = Color(NexusPalette.Light.Muted),
    surfaceTint = Color(NexusPalette.Light.Primary),
    inverseSurface = Color(NexusPalette.Light.Text), inverseOnSurface = Color(NexusPalette.Light.Bg),
    error = Color(NexusPalette.Light.Error), onError = Color(NexusPalette.Light.OnError),
    errorContainer = Color(NexusPalette.Light.ErrorContainer), onErrorContainer = Color(NexusPalette.Light.OnErrorContainer),
    outline = Color(NexusPalette.Light.Outline), outlineVariant = Color(NexusPalette.Light.OutlineVariant),
    surfaceContainerLowest = Color(NexusPalette.Light.Surface), surfaceContainerLow = Color(NexusPalette.Light.SurfaceLow),
    surfaceContainer = Color(NexusPalette.Light.SurfaceVariant), surfaceContainerHigh = Color(NexusPalette.Light.SurfaceHigh),
    surfaceContainerHighest = Color(NexusPalette.Light.SurfaceHigh)
)

private val DarkColors = darkColorScheme(
    primary = Color(NexusPalette.Dark.Primary), onPrimary = Color(NexusPalette.Dark.OnPrimary),
    primaryContainer = Color(NexusPalette.Dark.PrimaryContainer), onPrimaryContainer = Color(NexusPalette.Dark.OnPrimaryContainer),
    inversePrimary = Color(NexusPalette.Light.Primary),
    secondary = Color(NexusPalette.Dark.Secondary), onSecondary = Color(NexusPalette.Dark.OnSecondary),
    secondaryContainer = Color(NexusPalette.Dark.SecondaryContainer), onSecondaryContainer = Color(NexusPalette.Dark.OnSecondaryContainer),
    tertiary = Color(NexusPalette.Dark.Teal), onTertiary = Color(NexusPalette.Dark.OnTeal),
    tertiaryContainer = Color(NexusPalette.Dark.TealContainer), onTertiaryContainer = Color(NexusPalette.Dark.OnTealContainer),
    background = Color(NexusPalette.Dark.Bg), onBackground = Color(NexusPalette.Dark.Text),
    surface = Color(NexusPalette.Dark.Surface), onSurface = Color(NexusPalette.Dark.Text),
    surfaceVariant = Color(NexusPalette.Dark.SurfaceVariant), onSurfaceVariant = Color(NexusPalette.Dark.Muted),
    surfaceTint = Color(NexusPalette.Dark.Primary),
    inverseSurface = Color(NexusPalette.Dark.Text), inverseOnSurface = Color(NexusPalette.Dark.Bg),
    error = Color(NexusPalette.Dark.Error), onError = Color(NexusPalette.Dark.OnError),
    errorContainer = Color(NexusPalette.Dark.ErrorContainer), onErrorContainer = Color(NexusPalette.Dark.OnErrorContainer),
    outline = Color(NexusPalette.Dark.Outline), outlineVariant = Color(NexusPalette.Dark.OutlineVariant),
    surfaceContainerLowest = Color(NexusPalette.Dark.Bg), surfaceContainerLow = Color(NexusPalette.Dark.SurfaceLow),
    surfaceContainer = Color(NexusPalette.Dark.Surface), surfaceContainerHigh = Color(NexusPalette.Dark.SurfaceVariant),
    surfaceContainerHighest = Color(NexusPalette.Dark.SurfaceHigh)
)

private val NexusShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp)
)

private val Sans = FontFamily.SansSerif

private val NexusTypography = Typography(
    displayLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.ExtraBold, fontSize = 36.sp, lineHeight = 46.sp, letterSpacing = (-0.6).sp),
    headlineLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 38.sp),
    headlineMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 34.sp),
    headlineSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 30.sp),
    titleLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 28.sp),
    titleMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 24.sp),
    titleSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 27.sp),
    bodyMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 24.sp),
    bodySmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 19.sp),
    labelLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 17.sp),
    labelSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 16.sp)
)

@Composable
fun NexusTheme(mode: ThemeMode, content: @Composable () -> Unit) {
    val dark = when (mode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    CompositionLocalProvider(
        LocalLayoutDirection provides LayoutDirection.Rtl,
        LocalNexusExtras provides (if (dark) DarkExtras else LightExtras)
    ) {
        MaterialTheme(
            colorScheme = if (dark) DarkColors else LightColors,
            typography = NexusTypography,
            shapes = NexusShapes,
            content = content
        )
    }
}
