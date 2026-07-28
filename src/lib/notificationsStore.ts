import { NotificationItem, NotificationType } from "@/types/notification";
import { supabase } from "@/integrations/supabase/client";
import { sendNativeNotification } from "@/lib/pushNotifications";

export type NotificationPriority = "urgent" | "important" | "normal";

/**
 * Create a single notification and persist to Supabase DB
 */
export async function createNotification(params: {
  recipientId: string;
  actorId?: string;
  actorName?: string;
  actorAvatar?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  priority?: NotificationPriority;
}): Promise<string | null> {
  const { recipientId, actorId, actorName, actorAvatar, type, title, body, link, priority } = params;

  if (actorId && recipientId === actorId) return null;

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      recipient_id: recipientId,
      actor_id: actorId || null,
      actor_name: actorName || null,
      actor_avatar: actorAvatar || null,
      type,
      priority: priority || "normal",
      title,
      body,
      link: link || null,
    })
    .select("id")
    .single();

  if (error || !data) return null;

  sendNativeNotification(title, { body, url: link || "/" });
  return data.id;
}

/**
 * Broadcast a notification to multiple users (batch insert to DB)
 */
export async function broadcastNotification(params: {
  actorId?: string;
  actorName?: string;
  actorAvatar?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  currentUserId?: string;
  targetUserIds: string[];
  priority?: NotificationPriority;
}): Promise<number> {
  const { actorId, actorName, actorAvatar, type, title, body, link, currentUserId, targetUserIds, priority } = params;

  const recipients = targetUserIds.filter((uid) => uid && uid !== actorId && uid !== currentUserId);
  if (recipients.length === 0) return 0;

  const rows = recipients.map((uid) => ({
    recipient_id: uid,
    actor_id: actorId || null,
    actor_name: actorName || null,
    actor_avatar: actorAvatar || null,
    type,
    priority: priority || "normal",
    title,
    body,
    link: link || null,
  }));

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    console.error("Supabase insert notification error:", error);
    throw new Error(error.message || "خطأ أثناء حفظ الإشعارات في قاعدة البيانات");
  }

  try {
    sendNativeNotification(title, { body, url: link || "/" });
  } catch (err) {
    console.warn("Native notification dispatch error:", err);
  }

  return recipients.length;
}

/**
 * Fetch all notifications for a user from DB + real-time activity
 */
export async function fetchRealtimeNotifications(userId: string): Promise<NotificationItem[]> {
  if (!userId) return [];

  const items: NotificationItem[] = [];

  try {
    // 1. Fetch persisted notifications from DB
    const { data: dbNotifs } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    (dbNotifs ?? []).forEach((n) => {
      items.push({
        id: n.id,
        userId: n.recipient_id,
        actorId: n.actor_id ?? undefined,
        actorName: n.actor_name ?? undefined,
        actorAvatar: n.actor_avatar,
        type: n.type as NotificationType,
        priority: n.priority as NotificationPriority,
        title: n.title,
        body: n.body,
        link: n.link || undefined,
        read: n.read,
        createdAt: n.created_at,
      });
    });

    // 2. Fetch real-time activity (comments, reactions, messages, warnings)
    const { data: userPosts } = await supabase
      .from("posts")
      .select("id, content")
      .eq("author_id", userId);

    const postIds = (userPosts ?? []).map((p) => p.id);
    const postTitleMap = new Map((userPosts ?? []).map((p) => [p.id, p.content.slice(0, 30)]));

    if (postIds.length > 0) {
      const { data: comments } = await supabase
        .from("comments")
        .select("id, post_id, author_id, content, created_at")
        .in("post_id", postIds)
        .neq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: reactions } = await supabase
        .from("post_reactions")
        .select("post_id, user_id, reaction, created_at")
        .in("post_id", postIds)
        .neq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

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

      (comments ?? []).forEach((c) => {
        const notifId = `comment_${c.id}`;
        if (items.some((i) => i.id === notifId)) return;
        const prof = profileMap.get(c.author_id);
        const name = prof?.full_name || "زميل أكاديمي";
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
          read: false,
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

      (reactions ?? []).forEach((r) => {
        const notifId = `react_${r.post_id}_${r.user_id}_${r.reaction}`;
        if (items.some((i) => i.id === notifId)) return;
        const prof = profileMap.get(r.user_id);
        const name = prof?.full_name || "زميل أكاديمي";
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
          read: false,
          createdAt: r.created_at,
        });
      });
    }

    // 3. Direct Messages
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
          if (items.some((i) => i.id === notifId)) return;
          const sender = senderMap.get(m.sender_id);
          const name = sender?.full_name || "زميل";
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
            read: false,
            createdAt: m.created_at,
          });
        });
      }
    }

    // 4. User Warnings from Admin
    const { data: warnings } = await supabase
      .from("user_warnings")
      .select("id, reason, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    (warnings ?? []).forEach((w) => {
      const notifId = `warn_${w.id}`;
      if (items.some((i) => i.id === notifId)) return;
      items.push({
        id: notifId,
        userId,
        type: "announcement",
        title: "تنبيه إداري ⚠️",
        body: `سبب التنبيه: ${w.reason}`,
        link: "/feed",
        read: false,
        createdAt: w.created_at,
      });
    });

    // Deduplicate (DB notifications take priority over activity ones)
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
    return [];
  }
}

/**
 * Mark a single notification as read in DB
 */
export async function markNotificationAsRead(userId: string, notifId: string): Promise<void> {
  if (!userId || !notifId) return;
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notifId)
    .eq("recipient_id", userId);
}

/**
 * Mark all notifications as read in DB
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!userId) return;
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("recipient_id", userId)
    .eq("read", false);
}

/**
 * Delete a single notification from DB
 */
export async function deleteNotification(userId: string, notifId: string): Promise<void> {
  if (!userId || !notifId) return;
  await supabase
    .from("notifications")
    .delete()
    .eq("id", notifId)
    .eq("recipient_id", userId);
}

/**
 * Clear all DB notifications for user
 */
export async function clearAllNotifications(userId: string): Promise<void> {
  if (!userId) return;
  await supabase
    .from("notifications")
    .delete()
    .eq("recipient_id", userId);
}

/**
 * Fetch sent broadcast notifications grouped or listed for admin
 */
export async function fetchAdminSentNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Error fetching admin sent notifications:", error);
    return [];
  }
  return data ?? [];
}

/**
 * Update a notification content in DB
 */
export async function updateNotificationInDB(
  id: string,
  updates: { title?: string; body?: string; priority?: NotificationPriority; link?: string }
): Promise<boolean> {
  const { error } = await supabase
    .from("notifications")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Failed to update notification:", error);
    return false;
  }
  return true;
}

/**
 * Retract/Delete notification by ID or group
 */
export async function deleteNotificationFromDB(id: string): Promise<boolean> {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete notification:", error);
    return false;
  }
  return true;
}

/**
 * Get unread count from DB
 */
export async function getUnreadCount(userId: string): Promise<number> {
  if (!userId) return 0;
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("read", false);
  return count || 0;
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
