import { NotificationItem, NotificationType } from "@/types/notification";
import { supabase } from "@/integrations/supabase/client";
import { isActivityNotification, mergeNotificationSources } from "@/lib/notificationLogic";


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

  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("notifications")
    .insert({
      id,
      recipient_id: recipientId,
      actor_id: actorId || null,
      actor_name: actorName || null,
      actor_avatar: actorAvatar || null,
      type,
      priority: priority || "normal",
      title,
      body,
      link: link || null,
    });

  if (error) {
    console.warn("Notification delivery failed:", error.message);
    return null;
  }
  return id;
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

  const recipients = [...new Set(targetUserIds)].filter((uid) => uid && uid !== actorId && uid !== currentUserId);
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

  return recipients.length;
}

/**
 * Local (non-DB) notifications come from live activity (comments, reactions,
 * messages, warnings). They have no row in the notifications table, so their
 * read/dismissed state is kept per-user in localStorage.
 */
function isDbNotification(id: string) {
  return !isActivityNotification(id);
}

function localKey(userId: string, kind: "read" | "hidden") {
  return `nexus_notif_${kind}_${userId}`;
}

function readLocalSet(userId: string, kind: "read" | "hidden"): Set<string> {
  try {
    const raw = localStorage.getItem(localKey(userId, kind));
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function writeLocalSet(userId: string, kind: "read" | "hidden", set: Set<string>) {
  try {
    // keep the list bounded
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(localKey(userId, kind), JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

/**
 * Fetch all notifications for a user from DB + real-time activity
 */
export async function fetchRealtimeNotifications(userId: string): Promise<NotificationItem[]> {
  if (!userId) return [];
  const [persisted, activity] = await Promise.all([
    supabase.from("notifications").select("*").eq("recipient_id", userId)
      .order("created_at", { ascending: false }).limit(100),
    supabase.rpc("get_my_activity_notifications" as never),
  ]);
  if (persisted.error) throw new Error(persisted.error.message);
  if (activity.error) throw new Error(activity.error.message);
  type Row = { id: string; recipient_id: string; actor_id: string | null; actor_name: string | null;
    actor_avatar: string | null; type: string; priority: string; title: string; body: string;
    link: string | null; read: boolean; created_at: string };
  const rows = [...(persisted.data ?? []), ...((activity.data ?? []) as unknown as Row[])];
  const localRead = readLocalSet(userId, "read");
  const localHidden = readLocalSet(userId, "hidden");
  const items: NotificationItem[] = rows.map((n) => ({
    id: n.id, userId: n.recipient_id, actorId: n.actor_id ?? undefined,
    actorName: n.actor_name ?? undefined, actorAvatar: n.actor_avatar,
    type: n.type as NotificationType, priority: n.priority as NotificationPriority,
    title: n.title, body: n.body, link: n.link ?? undefined,
    read: n.read || localRead.has(n.id), createdAt: n.created_at,
  }));
  return mergeNotificationSources(items).filter((item) =>
    !localHidden.has(item.id) && !(item.activityIds ?? []).some((id) => localHidden.has(id)),
  );
}

/**
 * Mark a single notification as read (DB row or local activity item)
 */
export async function markNotificationAsRead(userId: string, notifId: string, activityIds: string[] = []): Promise<void> {
  if (!userId || !notifId) return;
  if (!isDbNotification(notifId)) {
    const set = readLocalSet(userId, "read");
    set.add(notifId);
    writeLocalSet(userId, "read", set);
    return;
  }
  const { error } = await supabase.from("notifications").update({ read: true })
    .eq("id", notifId).eq("recipient_id", userId);
  if (error) throw new Error(error.message);
  const set = readLocalSet(userId, "read");
  activityIds.forEach((id) => set.add(id));
  writeLocalSet(userId, "read", set);
}

/**
 * Mark all notifications as read (DB + local activity items)
 */
export async function markAllNotificationsAsRead(
  userId: string,
  localIds: string[] = [],
): Promise<void> {
  if (!userId) return;
  if (localIds.length) {
    const set = readLocalSet(userId, "read");
    localIds.forEach((id) => set.add(id));
    writeLocalSet(userId, "read", set);
  }
  const { error } = await supabase.from("notifications").update({ read: true })
    .eq("recipient_id", userId).eq("read", false);
  if (error) throw new Error(error.message);
}

/**
 * Delete a single notification (DB row) or hide a local activity item
 */
export async function deleteNotification(userId: string, notifId: string, activityIds: string[] = []): Promise<void> {
  if (!userId || !notifId) return;
  if (!isDbNotification(notifId)) {
    const set = readLocalSet(userId, "hidden");
    set.add(notifId);
    writeLocalSet(userId, "hidden", set);
    return;
  }
  const { error } = await supabase.from("notifications").delete()
    .eq("id", notifId).eq("recipient_id", userId);
  if (error) throw new Error(error.message);
  const set = readLocalSet(userId, "hidden");
  activityIds.forEach((id) => set.add(id));
  writeLocalSet(userId, "hidden", set);
}

/**
 * Clear all notifications for user (DB rows + currently listed local items)
 */
export async function clearAllNotifications(
  userId: string,
  localIds: string[] = [],
): Promise<void> {
  if (!userId) return;
  if (localIds.length) {
    const set = readLocalSet(userId, "hidden");
    localIds.forEach((id) => set.add(id));
    writeLocalSet(userId, "hidden", set);
  }
  const { error } = await supabase.from("notifications").delete().eq("recipient_id", userId);
  if (error) throw new Error(error.message);
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
    .eq("id", id).select("id").single();

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
  const { error } = await supabase.from("notifications").delete().eq("id", id).select("id").single();
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
