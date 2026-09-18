GRANT SELECT ON TABLE public.pinned_cards TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.pinned_cards TO authenticated;
GRANT ALL ON TABLE public.pinned_cards TO service_role;

DROP POLICY IF EXISTS "Users can vote on pinned cards" ON public.pinned_cards;
DROP POLICY IF EXISTS "Admins can insert pinned cards" ON public.pinned_cards;
DROP POLICY IF EXISTS "Admins can update pinned cards" ON public.pinned_cards;

CREATE POLICY "Admins can insert pinned cards"
ON public.pinned_cards FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'sub_admin'::public.app_role)
);

CREATE POLICY "Admins can update pinned cards"
ON public.pinned_cards FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'sub_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'sub_admin'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.vote_on_poll(p_user_id uuid, p_option_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_votes jsonb;
  available_options jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT votes, poll_options
  INTO current_votes, available_options
  FROM public.pinned_cards
  WHERE id = 'pinned_featured_event_1'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pinned card not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(available_options, '[]'::jsonb)) option_row
    WHERE option_row ->> 'id' = p_option_id
  ) THEN
    RAISE EXCEPTION 'Invalid poll option';
  END IF;

  current_votes := jsonb_set(
    COALESCE(current_votes, '{}'::jsonb),
    ARRAY[p_user_id::text],
    to_jsonb(p_option_id),
    true
  );

  UPDATE public.pinned_cards
  SET votes = current_votes,
      updated_at = now()
  WHERE id = 'pinned_featured_event_1';

  RETURN current_votes;
END;
$$;

REVOKE ALL ON FUNCTION public.vote_on_poll(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vote_on_poll(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.toggle_pinned_card_participation(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_participants jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT participants
  INTO current_participants
  FROM public.pinned_cards
  WHERE id = 'pinned_featured_event_1'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pinned card not found';
  END IF;

  current_participants := COALESCE(current_participants, '[]'::jsonb);

  IF current_participants @> jsonb_build_array(p_user_id::text) THEN
    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    INTO current_participants
    FROM jsonb_array_elements(current_participants) item
    WHERE item <> to_jsonb(p_user_id::text);
  ELSE
    current_participants := current_participants || jsonb_build_array(p_user_id::text);
  END IF;

  UPDATE public.pinned_cards
  SET participants = current_participants,
      updated_at = now()
  WHERE id = 'pinned_featured_event_1';

  RETURN current_participants;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_pinned_card_participation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_pinned_card_participation(uuid) TO authenticated, service_role;