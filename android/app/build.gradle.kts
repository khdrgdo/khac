plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

val nexusSupabaseUrl = providers.gradleProperty("nexusSupabaseUrl")
    .orElse(providers.environmentVariable("NEXUS_SUPABASE_URL"))
    .orElse("https://nzerffnvrvtmlnuqvhkw.supabase.co")
    .get()

val nexusSupabasePublishableKey = providers.gradleProperty("nexusSupabasePublishableKey")
    .orElse(providers.environmentVariable("NEXUS_SUPABASE_PUBLISHABLE_KEY"))
    .orElse("")
    .get()

android {
    namespace = "com.nexus.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.nexus.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "SUPABASE_URL", "\"" + nexusSupabaseUrl + "\"")
        buildConfigField("String", "SUPABASE_PUBLISHABLE_KEY", "\"" + nexusSupabasePublishableKey + "\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)

    implementation(platform(libs.supabase.bom))
    implementation(libs.supabase.auth)
    implementation(libs.supabase.postgrest)
    implementation(libs.supabase.realtime)
    implementation(libs.supabase.storage)
    implementation(libs.ktor.client.cio)

    debugImplementation(libs.androidx.compose.ui.tooling)
}
