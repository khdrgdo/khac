package com.nexus.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = NexusPrimary,
    onPrimary = NexusSurface,
    secondary = NexusPrimaryDark,
    background = NexusCanvas,
    onBackground = NexusInk,
    surface = NexusSurface,
    onSurface = NexusInk,
    outline = NexusLine,
    error = NexusDanger
)

private val DarkColors = darkColorScheme(
    primary = NexusPrimary,
    onPrimary = NexusSurface,
    secondary = NexusPrimaryDark,
    background = NexusDarkCanvas,
    onBackground = NexusDarkInk,
    surface = NexusDarkSurface,
    onSurface = NexusDarkInk,
    outline = NexusMuted,
    error = NexusDanger
)

@Composable
fun NexusTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}
