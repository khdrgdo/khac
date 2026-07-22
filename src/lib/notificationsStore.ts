import { NotificationItem, NotificationType } from "@/types/notification";

const NOTIFICATIONS_STORAGE_KEY = "academic_community_notifications_v2";

/**
 * Get all notifications for a given user ID
 */
export function getStoredNotifications(userId: string): NotificationItem[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${NOTIFICATIONS_STORAGE_KEY}_${userId}`);
    if (!raw) {
      // Seed default welcome notification for a better initial experience
      const initialSeed: NotificationItem[] = [
        {
          id: "welcome-seed-1",
          userId,
          type: "announcement",
          title: "مرحباً بك في المنصة الأكاديمية! 🎉",
          body: "يمكنك متابعة زملائك، نشر المقررات والأسئلة، وتلقي الإشعارات الفورية عن الردود والمواد الجديدة هنا.",
          link: "/feed",
          read: false,
          createdAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(`${NOTIFICATIONS_STORAGE_KEY}_${userId}`, JSON.stringify(initialSeed));
      return initialSeed;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse notifications:", e);
    return [];
  }
}

/**
 * Save notifications array for a given user
 */
export function saveNotifications(userId: string, items: NotificationItem[]): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${NOTIFICATIONS_STORAGE_KEY}_${userId}`, JSON.stringify(items));
    window.dispatchEvent(new Event("notifications_updated"));
  } catch (e) {
    console.error("Failed to save notifications:", e);
  }
}

/**
 * Send notification to a specific user
 */
export function createNotification(params: {
  recipientId: string;
  actorId?: string;
  actorName?: string;
  actorAvatar?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}): void {
  const { recipientId, actorId, actorName, actorAvatar, type, title, body, link } = params;

  // Don't notify oneself
  if (actorId && recipientId === actorId) return;

  const newNotif: NotificationItem = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: recipientId,
    actorId,
    actorName,
    actorAvatar,
    type,
    title,
    body,
    link,
    read: false,
    createdAt: new Date().toISOString(),
  };

  const existing = getStoredNotifications(recipientId);
  // Avoid duplicate exact same notification in short time
  const isDuplicate = existing.some(
    (n) => n.link === link && n.type === type && Date.now() - new Date(n.createdAt).getTime() < 10000
  );

  if (!isDuplicate) {
    const updated = [newNotif, ...existing].slice(0, 100); // keep top 100
    saveNotifications(recipientId, updated);
  }
}

/**
 * Broadcast a notification to all active local users or default key
 */
export function broadcastNotification(params: {
  actorId?: string;
  actorName?: string;
  actorAvatar?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  currentUserId?: string;
}): void {
  const { actorId, actorName, actorAvatar, type, title, body, link, currentUserId } = params;

  // Find all keys in localStorage that match notification key
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(NOTIFICATIONS_STORAGE_KEY)) {
      keys.push(key);
    }
  }

  // If no user keys yet, save under currentUserId or "global"
  if (keys.length === 0) {
    const target = currentUserId || "global";
    createNotification({
      recipientId: target,
      actorId,
      actorName,
      actorAvatar,
      type,
      title,
      body,
      link,
    });
    return;
  }

  keys.forEach((storageKey) => {
    const uId = storageKey.replace(`${NOTIFICATIONS_STORAGE_KEY}_`, "");
    if (uId && uId !== actorId) {
      createNotification({
        recipientId: uId,
        actorId,
        actorName,
        actorAvatar,
        type,
        title,
        body,
        link,
      });
    }
  });
}

/**
 * Mark single notification as read
 */
export function markNotificationAsRead(userId: string, notifId: string): void {
  const existing = getStoredNotifications(userId);
  const updated = existing.map((n) => (n.id === notifId ? { ...n, read: true } : n));
  saveNotifications(userId, updated);
}

/**
 * Mark all notifications as read
 */
export function markAllNotificationsAsRead(userId: string): void {
  const existing = getStoredNotifications(userId);
  const updated = existing.map((n) => ({ ...n, read: true }));
  saveNotifications(userId, updated);
}

/**
 * Delete single notification
 */
export function deleteNotification(userId: string, notifId: string): void {
  const existing = getStoredNotifications(userId);
  const updated = existing.filter((n) => n.id !== notifId);
  saveNotifications(userId, updated);
}

/**
 * Clear all notifications for user
 */
export function clearAllNotifications(userId: string): void {
  saveNotifications(userId, []);
}

/**
 * Format relative Arabic date time
 */
export function formatArabicTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "الآن";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `منذ ${diffInMinutes} د`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `منذ ${diffInHours} س`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `منذ ${diffInDays} يوم`;
    return date.toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
  } catch (e) {
    return "";
  }
}
