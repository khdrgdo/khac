DROP POLICY IF EXISTS "Users can send genuine notifications" ON public.notifications;
CREATE POLICY "Users can send genuine notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND type <> 'announcement'
  AND priority = ANY (ARRAY['low','normal','medium','high','important','urgent'])
);