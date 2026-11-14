package com.nexus.app.ui.theme

import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.pow

class NexusPaletteContrastTest {
    private fun channel(argb: Long, shift: Int): Double {
        val c = ((argb shr shift) and 0xFF).toDouble() / 255.0
        return if (c <= 0.03928) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
    }

    private fun luminance(argb: Long) =
        0.2126 * channel(argb, 16) + 0.7152 * channel(argb, 8) + 0.0722 * channel(argb, 0)

    private fun ratio(a: Long, b: Long): Double {
        val x = luminance(a); val y = luminance(b)
        return (maxOf(x, y) + 0.05) / (minOf(x, y) + 0.05)
    }

    private val textPairs = listOf(
        "OnSecondary" to "Secondary",
        "Secondary" to "Surface",
        "Secondary" to "Bg",
        "OnSecondaryContainer" to "SecondaryContainer",
        "Text" to "Bg",
        "Text" to "Surface",
        "Text" to "SurfaceVariant",
        "Text" to "SurfaceHigh",
        "Muted" to "Bg",
        "Muted" to "Surface",
        "Muted" to "SurfaceVariant",
        "Muted" to "SurfaceHigh",
        "OnPrimary" to "Primary",
        "OnPrimaryContainer" to "PrimaryContainer",
        "Primary" to "Bg",
        "Primary" to "Surface",
        "OnGold" to "Gold",
        "Gold" to "Surface",
        "Gold" to "Bg",
        "OnGoldContainer" to "GoldContainer",
        "OnTeal" to "Teal",
        "Teal" to "Surface",
        "Teal" to "Bg",
        "OnTealContainer" to "TealContainer",
        "Coral" to "Surface",
        "Coral" to "Bg",
        "OnCoralContainer" to "CoralContainer",
        "Error" to "Surface",
        "OnError" to "Error",
        "OnErrorContainer" to "ErrorContainer"
    )
    private val uiPairs = listOf("Outline" to "Bg", "Outline" to "Surface")

    private fun token(group: Any, name: String): Long {
        val field = group.javaClass.getDeclaredField(name)
        field.isAccessible = true
        return field.getLong(null)
    }

    private fun check(group: Any, label: String) {
        textPairs.forEach { (fg, bg) ->
            val r = ratio(token(group, fg), token(group, bg))
            assertTrue("$label $fg on $bg = $r (needs 4.5)", r >= 4.5)
        }
        uiPairs.forEach { (fg, bg) ->
            val r = ratio(token(group, fg), token(group, bg))
            assertTrue("$label $fg on $bg = $r (needs 3.0)", r >= 3.0)
        }
    }

    @Test fun lightPaletteMeetsWcagAA() = check(NexusPalette.Light, "light")
    @Test fun darkPaletteMeetsWcagAA() = check(NexusPalette.Dark, "dark")
}
