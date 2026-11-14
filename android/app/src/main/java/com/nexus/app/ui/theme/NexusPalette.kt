package com.nexus.app.ui.theme

/**
 * Raw ARGB tokens. Kept free of Compose types so unit tests can verify WCAG contrast on the JVM.
 * Any change here must keep NexusPaletteContrastTest green.
 */
object NexusPalette {
    object Light {
        const val Secondary = 0xFF5A4E8CL
        const val OnSecondary = 0xFFFFFFFFL
        const val SecondaryContainer = 0xFFE6E1F5L
        const val OnSecondaryContainer = 0xFF231A4AL
        const val Bg = 0xFFF7F5FBL
        const val Surface = 0xFFFFFFFFL
        const val SurfaceLow = 0xFFFBFAFEL
        const val SurfaceVariant = 0xFFEEE9F8L
        const val SurfaceHigh = 0xFFE7E1F4L
        const val Text = 0xFF1A1426L
        const val Muted = 0xFF5E5672L
        const val Primary = 0xFF5B2BD6L
        const val OnPrimary = 0xFFFFFFFFL
        const val PrimaryContainer = 0xFFE7DDFFL
        const val OnPrimaryContainer = 0xFF2A0F73L
        const val Outline = 0xFF7B7194L
        const val OutlineVariant = 0xFFCFC7E3L
        const val Gold = 0xFF8A5A00L
        const val OnGold = 0xFFFFFFFFL
        const val GoldContainer = 0xFFFFE9B8L
        const val OnGoldContainer = 0xFF3A2400L
        const val Teal = 0xFF0B7A6FL
        const val OnTeal = 0xFFFFFFFFL
        const val TealContainer = 0xFFD3F3EEL
        const val OnTealContainer = 0xFF04332EL
        const val Coral = 0xFFC7384AL
        const val CoralContainer = 0xFFFFE1E4L
        const val OnCoralContainer = 0xFF5C0F1AL
        const val Error = 0xFFB3261EL
        const val OnError = 0xFFFFFFFFL
        const val ErrorContainer = 0xFFFFDAD6L
        const val OnErrorContainer = 0xFF410002L
    }

    object Dark {
        const val Secondary = 0xFFC9BEF0L
        const val OnSecondary = 0xFF2B2150L
        const val SecondaryContainer = 0xFF3A3160L
        const val OnSecondaryContainer = 0xFFE6E1F5L
        const val Bg = 0xFF0F0B1AL
        const val Surface = 0xFF181226L
        const val SurfaceLow = 0xFF130E20L
        const val SurfaceVariant = 0xFF231B38L
        const val SurfaceHigh = 0xFF2C2347L
        const val Text = 0xFFF1EDFAL
        const val Muted = 0xFFB4A9CEL
        const val Primary = 0xFFB79CFFL
        const val OnPrimary = 0xFF1D0A52L
        const val PrimaryContainer = 0xFF3B2A7AL
        const val OnPrimaryContainer = 0xFFE7DDFFL
        const val Outline = 0xFF8F84AEL
        const val OutlineVariant = 0xFF4A3D6EL
        const val Gold = 0xFFF2C14EL
        const val OnGold = 0xFF3A2600L
        const val GoldContainer = 0xFF5A4000L
        const val OnGoldContainer = 0xFFFFE9B8L
        const val Teal = 0xFF5CD6C6L
        const val OnTeal = 0xFF00332DL
        const val TealContainer = 0xFF0E4A43L
        const val OnTealContainer = 0xFFBDF2EAL
        const val Coral = 0xFFFF8A93L
        const val CoralContainer = 0xFF5E1B26L
        const val OnCoralContainer = 0xFFFFD9DDL
        const val Error = 0xFFFFB4ABL
        const val OnError = 0xFF690005L
        const val ErrorContainer = 0xFF93000AL
        const val OnErrorContainer = 0xFFFFDAD6L
    }
}
