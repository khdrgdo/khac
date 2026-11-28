import type { Session } from "@supabase/supabase-js";

const STORAGE_KEY = "nexus_mobile_auth_redirect";
const TIMESTAMP_KEY = "nexus_mobile_auth_redirect_ts";
const REDIRECT_MAX_AGE_MS = 15 * 60 * 1000;
const ANDROID_CALLBACK = "com.nexus.app://login-callback";
const FLUTTER_CALLBACK = "com.nexus.flutter://login-callback";

export function validateMobileRedirect(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol === "com.nexus.app:" || parsed.protocol === "com.nexus.flutter:") &&
      parsed.hostname === "login-callback" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      !parsed.pathname &&
      !parsed.search &&
      !parsed.hash
    ) {
      return parsed.protocol === "com.nexus.flutter:" ? FLUTTER_CALLBACK : ANDROID_CALLBACK;
    }
  } catch {
    return null;
  }
  return null;
}

export function rememberMobileRedirect(value: string | null): string | null {
  const redirect = validateMobileRedirect(value);
  if (redirect) {
    const timestamp = String(Date.now());
    sessionStorage.setItem(STORAGE_KEY, redirect);
    sessionStorage.setItem(TIMESTAMP_KEY, timestamp);
    localStorage.setItem(STORAGE_KEY, redirect);
    localStorage.setItem(TIMESTAMP_KEY, timestamp);
  }
  return redirect;
}

export function getMobileRedirect(): string | null {
  const sessionRedirect = validateMobileRedirect(sessionStorage.getItem(STORAGE_KEY));
  const redirect = sessionRedirect ?? validateMobileRedirect(localStorage.getItem(STORAGE_KEY));
  if (!redirect) return null;

  const storedTimestamp = (sessionRedirect ? sessionStorage : localStorage).getItem(TIMESTAMP_KEY);
  const timestamp = Number(storedTimestamp);
  if (
    !storedTimestamp ||
    !Number.isFinite(timestamp) ||
    Date.now() - timestamp > REDIRECT_MAX_AGE_MS
  ) {
    clearMobileRedirect();
    return null;
  }
  return redirect;
}

export function clearMobileRedirect() {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(TIMESTAMP_KEY);
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TIMESTAMP_KEY);
}

function mobileSessionParams(session: Session) {
  return new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: String(session.expires_in ?? 3600),
    token_type: session.token_type || "bearer",
  });
}

export function buildMobileSessionLink(session: Session, redirect = getMobileRedirect()) {
  if (!redirect) return null;
  const params = mobileSessionParams(session);
  if (redirect === FLUTTER_CALLBACK) {
    return `intent://login-callback?${params.toString()}#Intent;scheme=com.nexus.flutter;package=com.nexus.flutter;end`;
  }
  return `${redirect}#${params.toString()}`;
}

export function buildMobileFallbackLink(session: Session, redirect = getMobileRedirect()) {
  if (!redirect) return null;
  const params = mobileSessionParams(session);
  return `${redirect}#${params.toString()}`;
}