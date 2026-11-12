package com.nexus.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class LoginIdentifierTest {
    @Test
    fun universityNumberUsesTheWebsiteIdentityFormat() {
        assertEquals("20261234@college.edu", normalizeLoginIdentifier(" 20261234 "))
    }

    @Test
    fun emailIsKeptUnchanged() {
        assertEquals("student@example.edu", normalizeLoginIdentifier("student@example.edu"))
    }

    @Test
    fun unsupportedUsernameIsRejected() {
        assertThrows(IllegalArgumentException::class.java) {
            normalizeLoginIdentifier("student-name")
        }
    }

    @Test
    fun majorLabelsMatchWebsiteCodes() {
        assertEquals("تقنية المعلومات", majorLabel("it"))
        assertEquals("نظم المعلومات", majorLabel("is"))
        assertEquals("هندسة البرمجيات", majorLabel("se"))
    }
}
