import type { NotificationItem } from "@/types/notification";

export function isActivityNotification(id: string): boolean {
  return /^(comment_|react_|msg_|warn_|points_)/.test(id);
}

/** Prefer the durable row but retain its activity alias for read/dismiss actions. */
export function mergeNotificationSources(items: NotificationItem[]): NotificationItem[] {
  const durable = items.filter((item) => !isActivityNotification(item.id));
  const result = new Map(durable.map((item) => [item.id, { ...item }]));
  for (const activity of items.filter((item) => isActivityNotification(item.id))) {
    const match = durable.find((row) =>
      row.type === activity.type && row.actorId === activity.actorId && row.link === activity.link &&
      Math.abs(Date.parse(row.createdAt) - Date.parse(activity.createdAt)) < 10_000,
    );
    if (match) {
      const row = result.get(match.id);
      if (row) result.set(match.id, { ...row, read: row.read || activity.read,
        activityIds: [...(row.activityIds ?? []), activity.id] });
    } else {
      result.set(activity.id, activity);
    }
  }
  return [...result.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function newlyArrivedNotifications(items: NotificationItem[], known: Set<string>, initialized: boolean) {
  return initialized ? items.filter((item) => !item.read && !known.has(item.id)) : [];
}