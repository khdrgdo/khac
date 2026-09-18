CREATE OR REPLACE FUNCTION public.protect_pinned_card_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_key text := auth.uid()::text;
  old_vote jsonb;
  new_vote jsonb;
  old_participates boolean;
  new_participates boolean;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'sub_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NEW.type IS DISTINCT FROM OLD.type
     OR NEW.theme IS DISTINCT FROM OLD.theme
     OR NEW.badge_text IS DISTINCT FROM OLD.badge_text
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.end_date IS DISTINCT FROM OLD.end_date
     OR NEW.action_button_text IS DISTINCT FROM OLD.action_button_text
     OR NEW.action_button_url IS DISTINCT FROM OLD.action_button_url
     OR NEW.target_year IS DISTINCT FROM OLD.target_year
     OR NEW.target_major IS DISTINCT FROM OLD.target_major
     OR NEW.poll_options IS DISTINCT FROM OLD.poll_options
     OR NEW.enabled IS DISTINCT FROM OLD.enabled
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only administrators can edit pinned card settings';
  END IF;

  old_vote := COALESCE(OLD.votes, '{}'::jsonb) - caller_key;
  new_vote := COALESCE(NEW.votes, '{}'::jsonb) - caller_key;
  IF new_vote IS DISTINCT FROM old_vote THEN
    RAISE EXCEPTION 'Cannot change another user vote';
  END IF;

  old_participates := COALESCE(OLD.participants, '[]'::jsonb) @> jsonb_build_array(caller_key);
  new_participates := COALESCE(NEW.participants, '[]'::jsonb) @> jsonb_build_array(caller_key);
  IF (
    SELECT COALESCE(jsonb_agg(item ORDER BY item::text), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(NEW.participants, '[]'::jsonb)) item
    WHERE item <> to_jsonb(caller_key)
  ) IS DISTINCT FROM (
    SELECT COALESCE(jsonb_agg(item ORDER BY item::text), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(OLD.participants, '[]'::jsonb)) item
    WHERE item <> to_jsonb(caller_key)
  ) THEN
    RAISE EXCEPTION 'Cannot change another participant';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE POLICY "Users can update their pinned card interaction"
ON public.pinned_cards FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

ALTER FUNCTION public.vote_on_poll(uuid, text) SECURITY INVOKER;
ALTER FUNCTION public.toggle_pinned_card_participation(uuid) SECURITY INVOKER;