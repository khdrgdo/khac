
-- 1) Promote 2011099840 to admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM public.profiles WHERE university_number = '2011099840'
ON CONFLICT DO NOTHING;

-- 2) Ranks system
DO $$ BEGIN CREATE TYPE public.rank_tier AS ENUM ('bronze','silver','gold','platinum','diamond'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE OR REPLACE FUNCTION public.compute_rank(_points INTEGER)
RETURNS public.rank_tier LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _points >= 1000 THEN 'diamond'::public.rank_tier
    WHEN _points >= 400  THEN 'platinum'::public.rank_tier
    WHEN _points >= 150  THEN 'gold'::public.rank_tier
    WHEN _points >= 50   THEN 'silver'::public.rank_tier
    ELSE 'bronze'::public.rank_tier
  END;
$$;

CREATE OR REPLACE FUNCTION public.award_points(_user UUID, _delta INTEGER)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET points = GREATEST(0, points + _delta), updated_at = now() WHERE id = _user;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_post_insert_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.award_points(NEW.author_id, 5); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_post_points ON public.posts;
CREATE TRIGGER trg_post_points AFTER INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.on_post_insert_points();

CREATE OR REPLACE FUNCTION public.on_comment_insert_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.award_points(NEW.author_id, 2); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_comment_points ON public.comments;
CREATE TRIGGER trg_comment_points AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.on_comment_insert_points();

CREATE OR REPLACE FUNCTION public.on_reaction_insert_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author UUID;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN PERFORM public.award_points(v_author, 1); END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reaction_points ON public.post_reactions;
CREATE TRIGGER trg_reaction_points AFTER INSERT ON public.post_reactions FOR EACH ROW EXECUTE FUNCTION public.on_reaction_insert_points();

-- 3) Banned words
CREATE TABLE IF NOT EXISTS public.banned_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banned_words TO authenticated;
GRANT ALL ON public.banned_words TO service_role;
ALTER TABLE public.banned_words ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read banned words" ON public.banned_words;
CREATE POLICY "read banned words" ON public.banned_words FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin manage banned words" ON public.banned_words;
CREATE POLICY "admin manage banned words" ON public.banned_words FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.banned_words (word) VALUES
  ('كس'),('طيز'),('زب'),('نيك'),('شرموط'),('عرص'),('حمار'),('كلب'),('لعنة'),('قحبة'),
  ('fuck'),('shit'),('bitch'),('asshole'),('cunt'),('dick'),('porn'),('sex')
ON CONFLICT DO NOTHING;

-- 4) Reports
DO $$ BEGIN CREATE TYPE public.report_status AS ENUM ('pending','confirmed','dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status public.report_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_reports TO authenticated;
GRANT ALL ON public.post_reports TO service_role;
ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user creates own reports" ON public.post_reports;
CREATE POLICY "user creates own reports" ON public.post_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "user reads own reports" ON public.post_reports;
CREATE POLICY "user reads own reports" ON public.post_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admin updates reports" ON public.post_reports;
CREATE POLICY "admin updates reports" ON public.post_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admin deletes reports" ON public.post_reports;
CREATE POLICY "admin deletes reports" ON public.post_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.on_report_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author UUID;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
    IF v_author IS NOT NULL THEN PERFORM public.award_points(v_author, -20); END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_report_confirmed ON public.post_reports;
CREATE TRIGGER trg_report_confirmed AFTER UPDATE ON public.post_reports FOR EACH ROW EXECUTE FUNCTION public.on_report_confirmed();

-- 5) Admin adjust points
CREATE OR REPLACE FUNCTION public.admin_adjust_points(_user UUID, _delta INTEGER)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.profiles SET points = GREATEST(0, points + _delta), updated_at = now() WHERE id = _user RETURNING points INTO v_new;
  RETURN v_new;
END; $$;

-- 6) Conversation helpers (SECURITY DEFINER to avoid RLS friction)
CREATE OR REPLACE FUNCTION public.create_dm(_other UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me UUID := auth.uid(); v_conv UUID; v_existing UUID;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF v_me = _other THEN RAISE EXCEPTION 'cannot dm yourself'; END IF;
  SELECT c.id INTO v_existing
  FROM public.conversations c
  WHERE c.is_group = false
    AND EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = c.id AND m.user_id = v_me)
    AND EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = c.id AND m.user_id = _other)
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  INSERT INTO public.conversations (is_group, created_by) VALUES (false, v_me) RETURNING id INTO v_conv;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (v_conv, v_me), (v_conv, _other);
  RETURN v_conv;
END; $$;

CREATE OR REPLACE FUNCTION public.create_group(_name TEXT, _members UUID[])
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me UUID := auth.uid(); v_conv UUID; v_uid UUID;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.conversations (is_group, name, created_by) VALUES (true, _name, v_me) RETURNING id INTO v_conv;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (v_conv, v_me) ON CONFLICT DO NOTHING;
  FOREACH v_uid IN ARRAY _members LOOP
    INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (v_conv, v_uid) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN v_conv;
END; $$;

-- 7) handle_new_user stores email + no default must_change_password
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_univ TEXT; v_name TEXT; v_major public.major_code; v_year SMALLINT; v_role public.app_role;
BEGIN
  v_univ := COALESCE(NEW.raw_user_meta_data->>'university_number', '');
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'مستخدم');
  BEGIN v_major := (NEW.raw_user_meta_data->>'major')::public.major_code; EXCEPTION WHEN OTHERS THEN v_major := NULL; END;
  BEGIN v_year := (NEW.raw_user_meta_data->>'year')::SMALLINT; EXCEPTION WHEN OTHERS THEN v_year := NULL; END;
  BEGIN v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student'); EXCEPTION WHEN OTHERS THEN v_role := 'student'; END;

  IF v_univ = '' THEN v_univ := 'U' || substr(NEW.id::text, 1, 8); END IF;

  INSERT INTO public.profiles (id, university_number, full_name, major, year, email, must_change_password)
  VALUES (NEW.id, v_univ, v_name, v_major, v_year, NEW.email, COALESCE((NEW.raw_user_meta_data->>'must_change_password')::BOOLEAN, false))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $function$;
