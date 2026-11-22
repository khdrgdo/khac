package com.nexus.app.data.auth

import org.junit.Assert.assertEquals
import org.junit.Test

class AuthIdentifierTest {
    @Test
    fun numericUniversityNumberUsesCollegeDomain() {
        assertEquals("123456@college.edu", AuthIdentifier.toAuthEmail("123456"))
    }

    @Test
    fun subAdminPrefixIsRemovedAndWhitespaceIsIgnored() {
        assertEquals("adminone@subadmin.edu", AuthIdentifier.toAuthEmail(" sub_Admin One "))
    }

    @Test
    fun plainNonNumericIdentifierUsesSubAdminDomain() {
        assertEquals("supervisor@subadmin.edu", AuthIdentifier.toAuthEmail("Supervisor"))
    }

    @Test
    fun explicitEmailIsPreserved() {
        assertEquals("person@example.com", AuthIdentifier.toAuthEmail(" person@example.com "))
    }
}
