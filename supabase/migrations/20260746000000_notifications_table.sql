-- Notifications table: persistent, cross-device, RLS-protected
CREATE TABLE notifications (
    id TEXT PRIMARY KEY DEFAULT ('notif_' || replace(gen_random_uuid()::text, '-', '')),
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    actor_name TEXT,
    actor_avatar TEXT,
    type TEXT NOT NULL DEFAULT 'announcement',
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'important', 'normal')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_read ON notifications(recipient_id, read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users read own notifications"
ON notifications FOR SELECT
USING (auth.uid() = recipient_id);

-- Admins and sub-admins can insert notifications for any user
CREATE POLICY "Admins can insert notifications"
ON notifications FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'sub_admin'::public.app_role));

-- System can insert notifications (for activity-based: comments, reactions, etc.)
-- This allows any authenticated user to create notifications for others (e.g. when commenting on a post)
CREATE POLICY "Authenticated users can insert notifications"
ON notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can mark own notifications read"
ON notifications FOR UPDATE
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON notifications FOR DELETE
USING (auth.uid() = recipient_id);

-- Admins can delete any notification
CREATE POLICY "Admins can delete any notification"
ON notifications FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Enable Realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
