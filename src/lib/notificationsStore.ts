import { NotificationItem, NotificationType } from "@/types/notification";
import { supabase } from "@/integrations/supabase/client";
import { sendNativeNotification } from "@/lib/pushNotifications";

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
    (n) =>
      n.link === link && n.type === type && Date.now() - new Date(n.createdAt).getTime() < 10000,
  );

  if (!isDuplicate) {
    const updated = [newNotif, ...existing].slice(0, 100); // keep top 100
    saveNotifications(recipientId, updated);

    // Trigger native browser device push notification
    sendNativeNotification(title, {
      body,
      url: link || "/",
    });
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
 * Read / Delete status persistence helpers for real-time notifications
 */
export function getReadNotificationIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`read_notif_ids_${userId}`);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function setNotificationAsRead(userId: string, notifId: string): void {
  const set = getReadNotificationIds(userId);
  set.add(notifId);
  localStorage.setItem(`read_notif_ids_${userId}`, JSON.stringify(Array.from(set)));
  markNotificationAsRead(userId, notifId);
}

export function getDeletedNotificationIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`deleted_notif_ids_${userId}`);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function setNotificationAsDeleted(userId: string, notifId: string): void {
  const set = getDeletedNotificationIds(userId);
  set.add(notifId);
  localStorage.setItem(`deleted_notif_ids_${userId}`, JSON.stringify(Array.from(set)));
  deleteNotification(userId, notifId);
}

export function getReadAllAtTimestamp(userId: string): string | null {
  return localStorage.getItem(`notifs_read_all_at_${userId}`);
}

export function setReadAllAtTimestamp(userId: string): void {
  const now = new Date().toISOString();
  localStorage.setItem(`notifs_read_all_at_${userId}`, now);
  markAllNotificationsAsRead(userId);
}

/**
 * Fetch real-time notifications directly from Supabase DB (comments, reactions, messages, warnings, course updates)
 */
export async function fetchRealtimeNotifications(userId: string): Promise<NotificationItem[]> {
  if (!userId) return [];

  const readIds = getReadNotificationIds(userId);
  const deletedIds = getDeletedNotificationIds(userId);
  const readAllAt = getReadAllAtTimestamp(userId);
  const readAllTime = readAllAt ? new Date(readAllAt).getTime() : 0;

  const items: NotificationItem[] = [];

  try {
    // 1. Posts written by the user
    const { data: userPosts } = await supabase
      .from("posts")
      .select("id, content")
      .eq("author_id", userId);

    const postIds = (userPosts ?? []).map((p) => p.id);
    const postTitleMap = new Map((userPosts ?? []).map((p) => [p.id, p.content.slice(0, 30)]));

    if (postIds.length > 0) {
      // Comments on user's posts
      const { data: comments } = await supabase
        .from("comments")
        .select("id, post_id, author_id, content, created_at")
        .in("post_id", postIds)
        .neq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      // Reactions on user's posts
      const { data: reactions } = await supabase
        .from("post_reactions")
        .select("post_id, user_id, reaction, created_at")
        .in("post_id", postIds)
        .neq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      // Collect profile IDs to display names and avatars
      const profileIds = new Set<string>();
      (comments ?? []).forEach((c) => profileIds.add(c.author_id));
      (reactions ?? []).forEach((r) => profileIds.add(r.user_id));

      const { data: profs } = profileIds.size
        ? await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", Array.from(profileIds))
        : { data: [] };

      const profileMap = new Map((profs ?? []).map((p) => [p.id, p]));

      // Map comments to notifications
      (comments ?? []).forEach((c) => {
        const notifId = `comment_${c.id}`;
        if (deletedIds.has(notifId)) return;
        const prof = profileMap.get(c.author_id);
        const name = prof?.full_name || "زميل أكاديمي";
        const isRead = readIds.has(notifId) || new Date(c.created_at).getTime() <= readAllTime;

        items.push({
          id: notifId,
          userId,
          actorId: c.author_id,
          actorName: name,
          actorAvatar: prof?.avatar_url,
          type: "post_comment",
          title: `قام ${name} بالتعليق على منشورك`,
          body: c.content,
          link: `/posts/${c.post_id}`,
          read: isRead,
          createdAt: c.created_at,
        });
      });

      const reactionEmojiMap: Record<string, string> = {
        like: "👍 إعجاب",
        love: "❤️ حب",
        laugh: "😂 ضحك",
        sad: "😢 حزن",
        angry: "😡 غضب",
        fire: "🔥 إبداع",
      };

      // Map reactions to notifications
      (reactions ?? []).forEach((r) => {
        const notifId = `react_${r.post_id}_${r.user_id}_${r.reaction}`;
        if (deletedIds.has(notifId)) return;
        const prof = profileMap.get(r.user_id);
        const name = prof?.full_name || "زميل أكاديمي";
        const isRead = readIds.has(notifId) || new Date(r.created_at).getTime() <= readAllTime;
        const emojiLabel = reactionEmojiMap[r.reaction] || "تفاعل";

        items.push({
          id: notifId,
          userId,
          actorId: r.user_id,
          actorName: name,
          actorAvatar: prof?.avatar_url,
          type: "post_like",
          title: `تفاعل جديد من ${name}`,
          body: `قام بالتفاعل بـ (${emojiLabel}) على منشورك: "${postTitleMap.get(r.post_id) || "منشورك"}"`,
          link: `/posts/${r.post_id}`,
          read: isRead,
          createdAt: r.created_at,
        });
      });
    }

    // 2. Direct Messages for User
    const { data: userConvs } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", userId);

    const convIds = (userConvs ?? []).map((c) => c.conversation_id);
    if (convIds.length > 0) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, created_at")
        .in("conversation_id", convIds)
        .neq("sender_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (msgs && msgs.length > 0) {
        const senderIds = Array.from(new Set(msgs.map((m) => m.sender_id)));
        const { data: senders } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", senderIds);
        const senderMap = new Map((senders ?? []).map((s) => [s.id, s]));

        msgs.forEach((m) => {
          const notifId = `msg_${m.id}`;
          if (deletedIds.has(notifId)) return;
          const sender = senderMap.get(m.sender_id);
          const name = sender?.full_name || "زميل";
          const isRead = readIds.has(notifId) || new Date(m.created_at).getTime() <= readAllTime;

          items.push({
            id: notifId,
            userId,
            actorId: m.sender_id,
            actorName: name,
            actorAvatar: sender?.avatar_url,
            type: "comment_reply",
            title: `رسالة خاصة من ${name}`,
            body: m.content,
            link: `/messages/${m.conversation_id}`,
            read: isRead,
            createdAt: m.created_at,
          });
        });
      }
    }

    // 3. User Warnings from Admin
    const { data: warnings } = await supabase
      .from("user_warnings")
      .select("id, reason, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    (warnings ?? []).forEach((w) => {
      const notifId = `warn_${w.id}`;
      if (deletedIds.has(notifId)) return;
      const isRead = readIds.has(notifId) || new Date(w.created_at).getTime() <= readAllTime;

      items.push({
        id: notifId,
        userId,
        type: "announcement",
        title: "تنبيه إداري ⚠️",
        body: `سبب التنبيه: ${w.reason}`,
        link: "/feed",
        read: isRead,
        createdAt: w.created_at,
      });
    });

    // 4. Local Seed & System Notifications
    const local = getStoredNotifications(userId);
    local.forEach((l) => {
      if (!deletedIds.has(l.id)) {
        const isRead =
          l.read || readIds.has(l.id) || new Date(l.createdAt).getTime() <= readAllTime;
        items.push({ ...l, read: isRead });
      }
    });

    // Deduplicate and sort descending by time
    const uniqueMap = new Map<string, NotificationItem>();
    items.forEach((item) => {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    });

    return Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch (err) {
    console.error("Error fetching realtime notifications:", err);
    return getStoredNotifications(userId);
  }
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
