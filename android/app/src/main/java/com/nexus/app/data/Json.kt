package com.nexus.app.data

import org.json.JSONArray
import org.json.JSONObject

fun parseRows(raw: String): List<JSONObject> {
    if (raw.isBlank()) return emptyList()
    val array = JSONArray(raw)
    return (0 until array.length()).mapNotNull { array.optJSONObject(it) }
}

fun JSONObject.str(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key).takeIf { it.isNotBlank() && it != "null" }
}

fun JSONObject.strList(key: String): List<String> {
    val array = optJSONArray(key) ?: return emptyList()
    return (0 until array.length()).mapNotNull { index ->
        array.optString(index).takeIf { it.isNotBlank() && it != "null" }
    }
}

/** Raw scalar returned by an RPC (a JSON string such as "uuid"). */
fun parseScalar(raw: String): String = raw.trim().trim('"')
