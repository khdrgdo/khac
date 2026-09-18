import type { Session } from "@supabase/supabase-js";

const STORAGE_KEY = "nexus_mobile_auth_redirect";
const ANDROID_CALLBACK = "com.nexus.app://login-callback";

export function validateMobileRedirect(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol === "com.nexus.app:" &&
      parsed.hostname === "login-callback" &&
      !parsed.pathname.replaceAll("/", "") &&
      !parsed.search &&
      !parsed.hash
    ) {
      return ANDROID_CALLBACK;
    }
  } catch {
    return null;
  }
  return null;
}

export function rememberMobileRedirect(value: string | null): string | null {
  const redirect = validateMobileRedirect(value);
  if (redirect) sessionStorage.setItem(STORAGE_KEY, redirect);
  return redirect;
}

export function getMobileRedirect(): string | null {
  return validateMobileRedirect(sessionStorage.getItem(STORAGE_KEY));
}

export function clearMobileRedirect() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function buildMobileSessionLink(session: Session, redirect = getMobileRedirect()) {
  if (!redirect) return null;
  const params = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: String(session.expires_in ?? 3600),
    token_type: session.token_type || "bearer",
  });
  return `${redirect}#${params.toString()}`;
}