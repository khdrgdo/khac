package com.nexus.app.data

import android.content.Context

/** Single repository instance per process so rotated refresh tokens are never used twice. */
object NexusGraph {
    @Volatile private var instance: NexusRepository? = null

    fun repository(context: Context): NexusRepository =
        instance ?: synchronized(this) {
            instance ?: NexusRepository(context.applicationContext).also { instance = it }
        }
}
