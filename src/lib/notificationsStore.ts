import { NotificationItem, NotificationType } from "@/types/notification";
import { supabase } from "@/integrations/supabase/client";
import { isActivityNotification, mergeNotificationSources } from "@/lib/notificationLogic";

export type NotificationPriority = "urgent" | "important" | "normal";

type ActivityRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  type: string;
  priority: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  hidden: boolean;
  created_at: string;
};

async function setActivityState(activityId: string, isRead: boolean, isHidden: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_activity_notification_state" as never, {
    _activity_id: activityId,
    _is_read: isRead,
    _is_hidden: isHidden,
  } as never);
  if (error) throw new Error(error.message);
}

/** Persist an activity notification only after the server validates its source. */
export async function createNotification(params: {
  sourceType: "post" | "comment" | "accepted_answer";
  sourceId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  priority?: NotificationPriority;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc("create_activity_notification" as never, {
    _source_type: params.sourceType,
    _source_id: params.sourceId,
    _type: params.type,
    _title: params.title,
    _body: params.body,
    _link: params.link ?? null,
    _priority: params.priority ?? "normal",
  } as never);

  if (error) {
    console.warn("Notification delivery failed:", error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

/** Broadcasts are an admin RPC; the server derives sender identity and validates recipients. */
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
  const { data, error } = await supabase.rpc("admin_broadcast_notifications" as never, {
    _recipient_ids: [...new Set(params.targetUserIds.filter(Boolean))],
    _type: params.type,
    _title: params.title,
    _body: params.body,
    _link: params.link ?? null,
    _priority: params.priority ?? "normal",
  } as never);

  if (error) {
    console.error("Supabase broadcast notification error:", error);
    throw new Error(error.message || "خطأ أثناء إرسال الإشعارات");
  }
  return Number(data ?? 0);
}

function isDbNotification(id: string) {
  return !isActivityNotification(id);
}

/** Activity read/dismissed state is stored in Supabase and syncs across devices. */
export async function fetchRealtimeNotifications(userId: string): Promise<NotificationItem[]> {
  if (!userId) return [];

  const [persisted, activity] = await Promise.all([
    supabase.from("notifications").select("*").eq("recipient_id", userId)
      .order("created_at", { ascending: false }).limit(100),
    supabase.rpc("get_my_activity_notifications" as never),
  ]);

  if (persisted.error) throw new Error(persisted.error.message);
  if (activity.error) throw new Error(activity.error.message);

  const activityRows = ((activity.data ?? []) as unknown as ActivityRow[]).filter((row) => !row.hidden);
  const rows = [...(persisted.data ?? []), ...activityRows];

  const items: NotificationItem[] = rows.map((n) => ({
    id: n.id,
    userId: n.recipient_id,
    actorId: n.actor_id ?? undefined,
    actorName: n.actor_name ?? undefined,
    actorAvatar: n.actor_avatar,
    type: n.type as NotificationType,
    priority: n.priority as NotificationPriority,
    title: n.title,
    body: n.body,
    link: n.link ?? undefined,
    read: n.read,
    createdAt: n.created_at,
  }));

  return mergeNotificationSources(items);
}

export async function markNotificationAsRead(
  userId: string,
  notifId: string,
  activityIds: string[] = [],
): Promise<void> {
  if (!userId || !notifId) return;

  if (!isDbNotification(notifId)) {
    await setActivityState(notifId, true, false);
  } else {
    const { error } = await supabase.from("notifications").update({ read: true })
      .eq("id", notifId).eq("recipient_id", userId);
    if (error) throw new Error(error.message);
  }

  await Promise.all([...new Set(activityIds)].map((id) => setActivityState(id, true, false)));
}

export async function markAllNotificationsAsRead(userId: string, localIds: string[] = []): Promise<void> {
  if (!userId) return;
  await Promise.all([...new Set(localIds)].map((id) => setActivityState(id, true, false)));
  const { error } = await supabase.from("notifications").update({ read: true })
    .eq("recipient_id", userId).eq("read", false);
  if (error) throw new Error(error.message);
}

export async function deleteNotification(
  userId: string,
  notifId: string,
  activityIds: string[] = [],
): Promise<void> {
  if (!userId || !notifId) return;

  if (!isDbNotification(notifId)) {
    await setActivityState(notifId, false, true);
  } else {
    const { error } = await supabase.from("notifications").delete()
      .eq("id", notifId).eq("recipient_id", userId);
    if (error) throw new Error(error.message);
  }

  await Promise.all([...new Set(activityIds)].map((id) => setActivityState(id, false, true)));
}

export async function clearAllNotifications(userId: string, localIds: string[] = []): Promise<void> {
  if (!userId) return;
  await Promise.all([...new Set(localIds)].map((id) => setActivityState(id, false, true)));
  const { error } = await supabase.from("notifications").delete().eq("recipient_id", userId);
  if (error) throw new Error(error.message);
}

/** RLS returns only broadcasts sent by the current administrator. */
export async function fetchAdminSentNotifications() {
  const { data, error } = await supabase.from("notifications").select("*")
    .order("created_at", { ascending: false }).limit(200);
  if (error) {
    console.error("Error fetching admin sent notifications:", error);
    return [];
  }
  return data ?? [];
}

export async function updateNotificationInDB(
  id: string,
  updates: { title?: string; body?: string; priority?: NotificationPriority; link?: string },
): Promise<boolean> {
  const { error } = await supabase.from("notifications").update(updates)
    .eq("id", id).select("id").single();
  if (error) {
    console.error("Failed to update notification:", error);
    return false;
  }
  return true;
}

export async function deleteNotificationFromDB(id: string): Promise<boolean> {
  const { error } = await supabase.from("notifications").delete().eq("id", id).select("id").single();
  if (error) {
    console.error("Failed to delete notification:", error);
    return false;
  }
  return true;
}

export async function getUnreadCount(userId: string): Promise<number> {
  if (!userId) return 0;

  const [persisted, activity] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("recipient_id", userId).eq("read", false),
    supabase.rpc("get_my_activity_notifications" as never),
  ]);

  if (persisted.error) throw new Error(persisted.error.message);
  if (activity.error) throw new Error(activity.error.message);

  const unreadActivity = ((activity.data ?? []) as unknown as ActivityRow[])
    .filter((row) => !row.read && !row.hidden).length;
  return (persisted.count ?? 0) + unreadActivity;
}

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
  } catch {
    return "";
  }
}
