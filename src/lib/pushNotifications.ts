/**
 * Utility to manage Web Push & System Native Device Notifications for NEXUS
 */

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermissionState(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn("Notifications are not supported in this browser.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // Send test welcome push
      sendNativeNotification("تم تفعيل الإشعارات بنجاح! 🔔", {
        body: "ستتلقى الآن تنبيهات فورية عن ملخصات الصف، الرسائل، والمستجدات الأكاديمية.",
        icon: "/pwa-192.png",
        badge: "/pwa-192.png",
        tag: "nexus-welcome",
      });
      return true;
    }
  }

  return false;
}

/**
 * Trigger a native OS / Device notification
 */
export function sendNativeNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    url?: string;
  },
) {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return;
  }

  const notificationOptions = {
    body: options?.body || "",
    icon: options?.icon || "/pwa-192.png",
    badge: options?.badge || "/pwa-192.png",
    tag: options?.tag || `nexus-notif-${Date.now()}`,
    data: { url: options?.url || "/" },
    dir: "rtl" as NotificationDirection,
    lang: "ar",
  };

  // Prefer ServiceWorker showNotification for persistent mobile push
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.showNotification(title, notificationOptions);
      })
      .catch(() => {
        new Notification(title, notificationOptions);
      });
  } else {
    new Notification(title, notificationOptions);
  }
}
