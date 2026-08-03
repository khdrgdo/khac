-- 1) anonymity flags + nullable authors
ALTER TABLE public.posts ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.comments ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

-- 2) hidden identity ledger
CREATE TABLE IF NOT EXISTS public.anonymous_authors (
  content_type text NOT NULL CHECK (content_type IN ('post','comment')),
  content_id uuid NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_type, content_id)
);
CREATE INDEX IF NOT EXISTS anonymous_authors_author_idx ON public.anonymous_authors(author_id);

GRANT SELECT ON public.anonymous_authors TO authenticated;
GRANT ALL ON public.anonymous_authors TO service_role;
ALTER TABLE public.anonymous_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_authors_select_admin_or_self" ON public.anonymous_authors
  FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'sub_admin')
  );

-- 3) ownership helper for anonymous content
CREATE OR REPLACE FUNCTION public.is_anonymous_owner(_type text, _id uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.anonymous_authors
    WHERE content_type = _type AND content_id = _id AND author_id = _user
  );
$$;

DROP POLICY IF EXISTS posts_delete_own_or_admin ON public.posts;
CREATE POLICY posts_delete_own_or_admin ON public.posts FOR DELETE
  USING (
    auth.uid() = author_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_anonymous_owner('post', id, auth.uid())
  );

DROP POLICY IF EXISTS posts_update_own ON public.posts;
CREATE POLICY posts_update_own ON public.posts FOR UPDATE
  USING (auth.uid() = author_id OR public.is_anonymous_owner('post', id, auth.uid()))
  WITH CHECK (auth.uid() = author_id OR public.is_anonymous_owner('post', id, auth.uid()));

DROP POLICY IF EXISTS comments_delete_own_or_admin ON public.comments;
CREATE POLICY comments_delete_own_or_admin ON public.comments FOR DELETE
  USING (
    auth.uid() = author_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_anonymous_owner('comment', id, auth.uid())
  );

DROP POLICY IF EXISTS comments_update_own ON public.comments;
CREATE POLICY comments_update_own ON public.comments FOR UPDATE
  USING (auth.uid() = author_id OR public.is_anonymous_owner('comment', id, auth.uid()))
  WITH CHECK (auth.uid() = author_id OR public.is_anonymous_owner('comment', id, auth.uid()));

-- 4) creation functions
CREATE OR REPLACE FUNCTION public.create_post_as(
  _content text,
  _images text[] DEFAULT '{}',
  _post_type public.post_type DEFAULT 'general',
  _anonymous boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); v_id uuid; v_banned boolean; v_until timestamptz;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT banned, suspended_until INTO v_banned, v_until FROM public.profiles WHERE id = v_me;
  IF COALESCE(v_banned,false) OR (v_until IS NOT NULL AND v_until > now()) THEN
    RAISE EXCEPTION 'account suspended';
  END IF;
  IF public.has_role(v_me,'sub_admin') THEN RAISE EXCEPTION 'sub admins cannot post'; END IF;

  IF NOT _anonymous THEN
    INSERT INTO public.posts (author_id, content, images, post_type, is_anonymous)
    VALUES (v_me, _content, _images, _post_type, false) RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.posts (author_id, content, images, post_type, is_anonymous)
    VALUES (NULL, _content, _images, _post_type, true) RETURNING id INTO v_id;
    INSERT INTO public.anonymous_authors (content_type, content_id, author_id)
    VALUES ('post', v_id, v_me);
    PERFORM public.award_points(v_me, 5);
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.create_comment_as(
  _post_id uuid,
  _content text,
  _parent_id uuid DEFAULT NULL,
  _anonymous boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); v_id uuid; v_banned boolean; v_until timestamptz;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT banned, suspended_until INTO v_banned, v_until FROM public.profiles WHERE id = v_me;
  IF COALESCE(v_banned,false) OR (v_until IS NOT NULL AND v_until > now()) THEN
    RAISE EXCEPTION 'account suspended';
  END IF;
  IF public.has_role(v_me,'sub_admin') THEN RAISE EXCEPTION 'sub admins cannot comment'; END IF;

  IF NOT _anonymous THEN
    INSERT INTO public.comments (post_id, parent_id, author_id, content, is_anonymous)
    VALUES (_post_id, _parent_id, v_me, _content, false) RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.comments (post_id, parent_id, author_id, content, is_anonymous)
    VALUES (_post_id, _parent_id, NULL, _content, true) RETURNING id INTO v_id;
    INSERT INTO public.anonymous_authors (content_type, content_id, author_id)
    VALUES ('comment', v_id, v_me);
    PERFORM public.award_points(v_me, 2);
  END IF;
  RETURN v_id;
END; $$;

-- 5) admin/sub-admin reveal
CREATE OR REPLACE FUNCTION public.get_anonymous_authors(_type text, _ids uuid[])
RETURNS TABLE(content_id uuid, author_id uuid, full_name text, avatar_url text, university_number text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'sub_admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  SELECT a.content_id, a.author_id, p.full_name, p.avatar_url, p.university_number
  FROM public.anonymous_authors a
  JOIN public.profiles p ON p.id = a.author_id
  WHERE a.content_type = _type AND a.content_id = ANY(_ids);
END; $$;

-- 6) security fix: stop notification spoofing
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Users can send genuine notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND type <> 'announcement'
    AND priority IN ('low','normal','medium','high')
  );
