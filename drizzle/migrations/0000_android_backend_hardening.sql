CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON public.notifications (recipient_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.search_public_profiles(_q text)
 RETURNS TABLE(id uuid, full_name text, university_number text, avatar_url text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name,
    CASE WHEN COALESCE(p.hide_university_number,false) AND p.id <> auth.uid() AND NOT v_admin THEN NULL ELSE p.university_number END,
    p.avatar_url
  FROM public.profiles p
  LEFT JOIN public.user_roles r ON p.id = r.user_id AND r.role = 'sub_admin'
  WHERE (p.full_name ILIKE '%' || _q || '%'
         OR (p.university_number ILIKE '%' || _q || '%'
             AND (NOT COALESCE(p.hide_university_number,false) OR p.id = auth.uid() OR v_admin)))
    AND (r.user_id IS NULL OR p.id = auth.uid() OR v_admin)
  LIMIT 20;
END; $function$;

CREATE OR REPLACE FUNCTION public.is_main_admin(_user_id uuid)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_univ TEXT; v_email TEXT;
BEGIN
  SELECT university_number, email INTO v_univ, v_email FROM public.profiles WHERE id = _user_id;
  RETURN COALESCE(v_univ = '2011099840' OR LOWER(v_email) IN ('khdrmamon@gmail.com','2011099840@college.edu'), false);
END; $function$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conv_id uuid, _user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.conversation_members SET last_read_at = now()
  WHERE conversation_id = _conv_id AND user_id = _user_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.leave_conversation(_conv_id uuid, _user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.conversation_members WHERE conversation_id = _conv_id AND user_id = _user_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.delete_conversation(_conv_id uuid, _user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversations c
    WHERE c.id = _conv_id AND (c.created_by = _user_id OR public.has_role(_user_id, 'admin'::public.app_role))) THEN
    RAISE EXCEPTION 'Not authorized to delete this conversation';
  END IF;
  DELETE FROM public.conversations WHERE id = _conv_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_unread_message_count(_user_id uuid)
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::int FROM public.messages m
  JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
  WHERE cm.user_id = _user_id AND _user_id = auth.uid()
    AND m.sender_id <> _user_id AND m.created_at > COALESCE(cm.last_read_at, '-infinity');
$function$;

CREATE OR REPLACE FUNCTION public.get_conversation_unread_counts(_user_id uuid)
 RETURNS TABLE(conversation_id uuid, unread_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT cm.conversation_id, COUNT(m.id) FROM public.conversation_members cm
  JOIN public.messages m ON m.conversation_id = cm.conversation_id
  WHERE cm.user_id = _user_id AND _user_id = auth.uid()
    AND m.sender_id <> _user_id AND m.created_at > COALESCE(cm.last_read_at, '-infinity')
  GROUP BY cm.conversation_id;
$function$;

REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid,uuid), public.leave_conversation(uuid,uuid), public.delete_conversation(uuid,uuid), public.get_unread_message_count(uuid), public.get_conversation_unread_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid,uuid), public.leave_conversation(uuid,uuid), public.delete_conversation(uuid,uuid), public.get_unread_message_count(uuid), public.get_conversation_unread_counts(uuid) TO authenticated;

ALTER FUNCTION public.vote_on_poll(uuid, text) SECURITY DEFINER;
ALTER FUNCTION public.toggle_pinned_card_participation(uuid) SECURITY DEFINER;
DROP POLICY IF EXISTS "Users can update their pinned card interaction" ON public.pinned_cards;