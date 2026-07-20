-- Question/answer system on top of posts+comments.

DO $$ BEGIN
  CREATE TYPE public.post_type AS ENUM ('general', 'question');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS post_type public.post_type NOT NULL DEFAULT 'general';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS accepted_answer_id uuid REFERENCES public.comments(id) ON DELETE SET NULL;

-- Integrity + one-shot acceptance, enforced at the DB layer (not just UI):
--  1) accepted_answer_id may only point at a comment that actually belongs
--     to this post (prevents accepting a reply from a different thread).
--  2) accepted_answer_id may only be set on a post with post_type='question'.
--  3) once set to a comment, it cannot be swapped directly to a *different*
--     comment (must be cleared to NULL first, then re-set) — this is what
--     "block further accept actions once one is set" means in practice
--     without also blocking the ability to correct a mistake.
-- Admins bypass all three so moderation isn't stuck if something needs a
-- manual fix.
CREATE OR REPLACE FUNCTION public.protect_accepted_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.accepted_answer_id IS NOT DISTINCT FROM OLD.accepted_answer_id THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.accepted_answer_id IS NOT NULL THEN
    IF NEW.post_type <> 'question' THEN
      RAISE EXCEPTION 'accepted_answer_id can only be set on question posts';
    END IF;
    IF OLD.accepted_answer_id IS NOT NULL THEN
      RAISE EXCEPTION 'an answer is already accepted for this question — clear it before accepting another';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.comments c WHERE c.id = NEW.accepted_answer_id AND c.post_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'accepted_answer_id must reference a comment on this post';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_accepted_answer ON public.posts;
CREATE TRIGGER trg_protect_accepted_answer
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_accepted_answer();

CREATE INDEX IF NOT EXISTS idx_posts_type ON public.posts(post_type);
