-- 1. Add last_read_at to conversation_members for unread tracking
ALTER TABLE conversation_members ADD COLUMN last_read_at TIMESTAMPTZ DEFAULT now();

-- 2. RPC: Get total unread message count for a user across all conversations
CREATE OR REPLACE FUNCTION public.get_unread_message_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::int
  FROM public.messages m
  INNER JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
  WHERE cm.user_id = _user_id
    AND m.sender_id != _user_id
    AND m.created_at > cm.last_read_at;
$$;

-- 3. RPC: Get per-conversation unread counts for a user
CREATE OR REPLACE FUNCTION public.get_conversation_unread_counts(_user_id uuid)
RETURNS TABLE(conversation_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    cm.conversation_id,
    COUNT(m.id) as unread_count
  FROM public.conversation_members cm
  INNER JOIN public.messages m ON m.conversation_id = cm.conversation_id
  WHERE cm.user_id = _user_id
    AND m.sender_id != _user_id
    AND m.created_at > cm.last_read_at
  GROUP BY cm.conversation_id;
$$;

-- 4. RPC: Mark a conversation as read for a user
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conv_id uuid, _user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.conversation_members
  SET last_read_at = now()
  WHERE conversation_id = _conv_id AND user_id = _user_id;
$$;

-- 5. RPC: Leave a conversation (remove yourself)
CREATE OR REPLACE FUNCTION public.leave_conversation(_conv_id uuid, _user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.conversation_members
  WHERE conversation_id = _conv_id AND user_id = _user_id;
$$;

-- 6. RPC: Delete a conversation (only creator or admin can)
CREATE OR REPLACE FUNCTION public.delete_conversation(_conv_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conv_id AND (c.created_by = _user_id OR public.has_role(_user_id, 'admin'::public.app_role))
  ) THEN
    RAISE EXCEPTION 'Not authorized to delete this conversation';
  END IF;
  DELETE FROM public.conversations WHERE id = _conv_id;
END; $$;
