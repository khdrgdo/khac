CREATE OR REPLACE FUNCTION vote_on_poll(p_user_id UUID, p_option_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  current_votes JSONB;
  current_participants JSONB;
BEGIN
  SELECT votes, participants INTO current_votes, current_participants
  FROM pinned_cards
  WHERE id = 'pinned_featured_event_1'
  FOR UPDATE;

  current_votes = jsonb_set(
    COALESCE(current_votes, '{}'::jsonb),
    ARRAY[p_user_id::text],
    to_jsonb(p_option_id)
  );

  IF NOT current_participants @> to_jsonb(p_user_id::text) THEN
    current_participants = current_participants || to_jsonb(p_user_id::text);
  END IF;

  UPDATE pinned_cards
  SET votes = current_votes,
      participants = current_participants,
      updated_at = now()
  WHERE id = 'pinned_featured_event_1';

  RETURN current_votes;
END;
$$;

GRANT EXECUTE ON FUNCTION vote_on_poll TO authenticated;
