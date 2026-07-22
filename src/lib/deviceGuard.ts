// Device Guard Utility to prevent multi-account spamming on the same physical phone/browser

const DEVICE_ID_KEY = "collegial_app_device_token";
const BOUND_USER_ID_KEY = "collegial_app_bound_user_id";
const BOUND_USER_EMAIL_KEY = "collegial_app_bound_user_email";

/**
 * Get or create a persistent device token stored in localStorage + Cookie
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";

  try {
    let devId = localStorage.getItem(DEVICE_ID_KEY);
    if (!devId) {
      // Look in document.cookie
      const match = document.cookie.match(new RegExp("(^| )" + DEVICE_ID_KEY + "=([^;]+)"));
      if (match && match[2]) {
        devId = match[2];
      }
    }

    if (!devId) {
      devId = "dev_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now().toString(36);
    }

    localStorage.setItem(DEVICE_ID_KEY, devId);
    // Set cookie for 2 years
    document.cookie = `${DEVICE_ID_KEY}=${devId}; path=/; max-age=63072000; SameSite=Lax`;
    return devId;
  } catch {
    return "dev_fallback_" + Date.now();
  }
}

/**
 * Check if the current device is already bound to a different user account
 */
export function checkDeviceAccountConflict(
  currentUserId?: string,
  currentEmail?: string,
): {
  isBlocked: boolean;
  boundEmail?: string;
} {
  if (typeof window === "undefined") return { isBlocked: false };

  try {
    const boundUserId = localStorage.getItem(BOUND_USER_ID_KEY);
    const boundEmail = localStorage.getItem(BOUND_USER_EMAIL_KEY);

    // If there is a bound account on this device
    if (boundUserId) {
      // If current user is trying to log in or sign up with a DIFFERENT user ID
      if (currentUserId && boundUserId !== currentUserId) {
        return {
          isBlocked: true,
          boundEmail: boundEmail || "حساب آخر",
        };
      }
    }
  } catch (e) {
    console.error("Device check error:", e);
  }

  return { isBlocked: false };
}

/**
 * Check if signup is allowed on this device (i.e., no other account is already registered/bound)
 */
export function isSignupAllowedOnDevice(): {
  allowed: boolean;
  existingEmail?: string;
} {
  if (typeof window === "undefined") return { allowed: true };

  try {
    const boundUserId = localStorage.getItem(BOUND_USER_ID_KEY);
    const boundEmail = localStorage.getItem(BOUND_USER_EMAIL_KEY);

    if (boundUserId) {
      return {
        allowed: false,
        existingEmail: boundEmail || "حسابك السابق",
      };
    }
  } catch (e) {
    console.error("Device signup check error:", e);
  }

  return { allowed: true };
}

/**
 * Bind the current user account to this device permanently
 */
export function bindAccountToDevice(userId: string, email?: string) {
  if (typeof window === "undefined" || !userId) return;

  try {
    getOrCreateDeviceId();
    localStorage.setItem(BOUND_USER_ID_KEY, userId);
    if (email) {
      localStorage.setItem(BOUND_USER_EMAIL_KEY, email);
      document.cookie = `${BOUND_USER_EMAIL_KEY}=${encodeURIComponent(email)}; path=/; max-age=63072000; SameSite=Lax`;
    }
    document.cookie = `${BOUND_USER_ID_KEY}=${userId}; path=/; max-age=63072000; SameSite=Lax`;
  } catch (e) {
    console.error("Failed to bind device:", e);
  }
}

/**
 * Clear device binding (Admin or explicit user device release)
 */
export function clearDeviceBinding() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(BOUND_USER_ID_KEY);
    localStorage.removeItem(BOUND_USER_EMAIL_KEY);
    document.cookie = `${BOUND_USER_ID_KEY}=; path=/; max-age=0;`;
    document.cookie = `${BOUND_USER_EMAIL_KEY}=; path=/; max-age=0;`;
  } catch (e) {
    console.error("Failed to clear device binding:", e);
  }
}
