# NEXUS Android Auth Redirect Configuration

The Android app uses Supabase Auth PKCE with the native redirect URI:

- Scheme: nexus
- Host: auth
- Redirect URI: nexus://auth

Before testing Google OAuth, email confirmation or password recovery, add the exact redirect URI (and any required wildcard path) to the Supabase project's Auth URL Configuration allowlist. The repository cannot prove this dashboard setting is active.

The app handles incoming links in MainActivity.onCreate and onNewIntent using the Supabase Kotlin SDK's handleDeeplinks extension. Do not pass access_token or refresh_token in a custom URL query parameter.
