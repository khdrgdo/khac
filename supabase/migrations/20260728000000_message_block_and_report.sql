-- Real block + report system for direct messages. Replaces the previous
-- client-side-only localStorage "block" (which did nothing server-side and
-- did not stop the other person from still messaging you) and the report
-- button (which only showed a fake success toast — nothing was ever
-- written anywhere, so no report ever reached an admin).

CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.blocked_users TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;

CREATE POLICY "blocked_users_select_own" ON public.blocked_users FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "blocked_users_insert_own" ON public.blocked_users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocked_users_delete_own" ON public.blocked_users FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  reason text NOT NULL,
  note text,
  status public.report_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.message_reports TO authenticated;
GRANT ALL ON public.message_reports TO service_role;

CREATE POLICY "message_reports_select_own_or_admin" ON public.message_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "message_reports_insert_own" ON public.message_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "message_reports_update_admin" ON public.message_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Enforce blocking where it actually matters: at send time, DB-side, not
-- just as a client-side "please don't click send" check. Covers both
-- directions (you blocked them, or they blocked you) for any other member
-- of the conversation.
CREATE OR REPLACE FUNCTION public.check_message_not_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.conversation_members cm
    JOIN public.blocked_users b
      ON (b.blocker_id = cm.user_id AND b.blocked_id = NEW.sender_id)
      OR (b.blocked_id = cm.user_id AND b.blocker_id = NEW.sender_id)
    WHERE cm.conversation_id = NEW.conversation_id
      AND cm.user_id <> NEW.sender_id
  ) THEN
    RAISE EXCEPTION 'blocked: you cannot message a user you have blocked, or who has blocked you';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_message_not_blocked ON public.messages;
CREATE TRIGGER trg_check_message_not_blocked
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_message_not_blocked();
