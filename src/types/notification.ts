export type NotificationType =
  | "course_added"
  | "material_added"
  | "comment_reply"
  | "post_comment"
  | "post_like"
  | "comment_like"
  | "announcement"
  | "points_awarded";

export interface NotificationItem {
  id: string;
  userId: string; // Recipient user ID (or "all" for global broadcast)
  actorId?: string; // User ID who initiated the action
  actorName?: string;
  actorAvatar?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string; // Navigation link (e.g. /posts/123 or /courses/456)
  read: boolean;
  createdAt: string; // ISO date string
}
