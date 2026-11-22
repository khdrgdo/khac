package com.nexus.app.data.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import io.github.jan.supabase.auth.SessionManager
import io.github.jan.supabase.auth.exception.NoSessionFoundException
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.serialization.json.Json
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class KeystoreSessionManager(context: Context) : SessionManager {
    private val preferences = context.applicationContext.getSharedPreferences(
        PREFERENCES_NAME,
        Context.MODE_PRIVATE
    )
    private val json = Json {
        encodeDefaults = true
        ignoreUnknownKeys = true
    }

    override suspend fun saveSession(session: UserSession) {
        val plainText = json.encodeToString(UserSession.serializer(), session)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val encrypted = cipher.doFinal(plainText.toByteArray(StandardCharsets.UTF_8))
        val payload = ByteBuffer
            .allocate(cipher.iv.size + encrypted.size)
            .put(cipher.iv)
            .put(encrypted)
            .array()

        val saved = preferences.edit()
            .putString(SESSION_KEY, Base64.encodeToString(payload, Base64.NO_WRAP))
            .commit()

        if (!saved) throw IOException("تعذر حفظ جلسة الدخول بأمان")
    }

    override suspend fun loadSession(): UserSession {
        val encoded = preferences.getString(SESSION_KEY, null)
            ?: throw NoSessionFoundException()

        return try {
            val payload = Base64.decode(encoded, Base64.NO_WRAP)
            if (payload.size <= IV_LENGTH) throw NoSessionFoundException()

            val iv = payload.copyOfRange(0, IV_LENGTH)
            val encrypted = payload.copyOfRange(IV_LENGTH, payload.size)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(
                Cipher.DECRYPT_MODE,
                getOrCreateKey(),
                GCMParameterSpec(TAG_LENGTH_BITS, iv)
            )
            val plainText = cipher.doFinal(encrypted).toString(StandardCharsets.UTF_8)
            json.decodeFromString(UserSession.serializer(), plainText)
        } catch (error: Exception) {
            deleteStoredValue()
            throw NoSessionFoundException()
        }
    }

    override suspend fun deleteSession() {
        deleteStoredValue()
    }

    private fun deleteStoredValue() {
        preferences.edit().remove(SESSION_KEY).commit()
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }
        val existing = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing

        val generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEY_STORE
        )
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    private companion object {
        const val PREFERENCES_NAME = "nexus_secure_auth"
        const val SESSION_KEY = "encrypted_session"
        const val KEY_ALIAS = "com.nexus.app.supabase.session"
        const val ANDROID_KEY_STORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_LENGTH = 12
        const val TAG_LENGTH_BITS = 128
    }
}
