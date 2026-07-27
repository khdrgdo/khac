export type NotificationType =
  | "course_added"
  | "material_added"
  | "comment_reply"
  | "post_comment"
  | "post_like"
  | "comment_like"
  | "announcement"
  | "points_awarded";

export type NotificationPriority = "urgent" | "important" | "normal";

export interface NotificationItem {
  id: string;
  userId: string;
  actorId?: string;
  actorName?: string;
  actorAvatar?: string | null;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}
