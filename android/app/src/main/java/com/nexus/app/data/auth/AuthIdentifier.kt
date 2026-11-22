package com.nexus.app.data.auth

object AuthIdentifier {
    fun toAuthEmail(identifier: String): String {
        val value = identifier.trim()
        require(value.isNotEmpty()) { "معرّف الحساب مطلوب" }

        if (value.contains("@")) return value

        if (value.all(Char::isDigit)) {
            return value + "@college.edu"
        }

        val normalized = value
            .lowercase()
            .filterNot(Char::isWhitespace)
            .removePrefix("sub_")

        require(normalized.isNotEmpty()) { "اسم المشرف غير صالح" }
        return normalized + "@subadmin.edu"
    }
}
