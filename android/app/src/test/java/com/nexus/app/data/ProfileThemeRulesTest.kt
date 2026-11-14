package com.nexus.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProfileThemeRulesTest {
    @Test fun defaultThemeTracksTheFiveRankThresholds() {
        assertEquals("stars", ProfileThemeRules.defaultForPoints(0))
        assertEquals("clouds", ProfileThemeRules.defaultForPoints(100))
        assertEquals("moon", ProfileThemeRules.defaultForPoints(300))
        assertEquals("sun", ProfileThemeRules.defaultForPoints(700))
        assertEquals("galaxy", ProfileThemeRules.defaultForPoints(1500))
    }
    @Test fun aThemeUnlocksAtItsExactThreshold() {
        assertTrue(ProfileThemeRules.isUnlocked(100, "clouds"))
        assertTrue(ProfileThemeRules.isUnlocked(300, "moon"))
        assertTrue(ProfileThemeRules.isUnlocked(700, "sun"))
        assertTrue(ProfileThemeRules.isUnlocked(1500, "galaxy"))
    }
    @Test fun aThemeDoesNotUnlockBeforeItsThreshold() {
        assertFalse(ProfileThemeRules.isUnlocked(99, "clouds"))
        assertFalse(ProfileThemeRules.isUnlocked(299, "moon"))
        assertFalse(ProfileThemeRules.isUnlocked(699, "sun"))
        assertFalse(ProfileThemeRules.isUnlocked(1499, "galaxy"))
    }
    @Test fun unknownThemeIdsAreNeverUnlocked() {
        assertFalse(ProfileThemeRules.isUnlocked(10000, "unknown"))
    }
}
