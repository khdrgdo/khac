-- The "Users can vote on pinned cards" policy allows any authenticated
-- user to UPDATE the entire pinned_cards row (USING (auth.uid() IS NOT
-- NULL) with no column restriction) so people can vote/participate via a
-- JSONB column. That also means any logged-in user can currently rewrite
-- the card's title, description, image, links, theme, etc. — not just
-- cast a vote. Lock non-admin updates down to only the votes/participants
-- columns via a trigger, same pattern already used elsewhere in this
-- project (protect_privileged_profile_columns).

CREATE OR REPLACE FUNCTION public.protect_pinned_card_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'sub_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  NEW.type := OLD.type;
  NEW.theme := OLD.theme;
  NEW.badge_text := OLD.badge_text;
  NEW.title := OLD.title;
  NEW.description := OLD.description;
  NEW.image_url := OLD.image_url;
  NEW.end_date := OLD.end_date;
  NEW.action_button_text := OLD.action_button_text;
  NEW.action_button_url := OLD.action_button_url;
  NEW.target_year := OLD.target_year;
  NEW.target_major := OLD.target_major;
  NEW.poll_options := OLD.poll_options;
  NEW.enabled := OLD.enabled;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_pinned_card_columns ON public.pinned_cards;
CREATE TRIGGER trg_protect_pinned_card_columns
  BEFORE UPDATE ON public.pinned_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_pinned_card_columns();
