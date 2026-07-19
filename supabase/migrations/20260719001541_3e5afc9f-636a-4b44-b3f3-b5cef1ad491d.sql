
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS warning_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS image_paths TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS schedule JSONB;

CREATE TABLE IF NOT EXISTS public.course_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_paths TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_updates TO authenticated;
GRANT ALL ON public.course_updates TO service_role;
ALTER TABLE public.course_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cu_select" ON public.course_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "cu_insert" ON public.course_updates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "cu_update" ON public.course_updates FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "cu_delete" ON public.course_updates FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_actions TO authenticated;
GRANT ALL ON public.admin_actions TO service_role;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aa_select" ON public.admin_actions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "aa_insert" ON public.admin_actions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') AND admin_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.user_warnings TO authenticated;
GRANT ALL ON public.user_warnings TO service_role;
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uw_select" ON public.user_warnings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "uw_insert" ON public.user_warnings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "avatars_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "avatars_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "postimg_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'post-images');
CREATE POLICY "postimg_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "postimg_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-images' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "coursefiles_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'course-files');
CREATE POLICY "coursefiles_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-files' AND (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "coursefiles_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'course-files' AND (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin')));

CREATE OR REPLACE FUNCTION public.on_report_auto_warn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author UUID; v_count INT;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
    IF v_author IS NOT NULL THEN
      INSERT INTO public.user_warnings (user_id, reason, issued_by)
        VALUES (v_author, 'بلاغ مؤكّد على منشور', NEW.reviewed_by);
      UPDATE public.profiles SET warning_count = warning_count + 1 WHERE id = v_author RETURNING warning_count INTO v_count;
      IF v_count >= 3 THEN
        UPDATE public.profiles SET suspended_until = now() + interval '7 days' WHERE id = v_author;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_report_auto_warn ON public.post_reports;
CREATE TRIGGER trg_report_auto_warn AFTER UPDATE ON public.post_reports
  FOR EACH ROW EXECUTE FUNCTION public.on_report_auto_warn();

CREATE OR REPLACE FUNCTION public.admin_set_year(_user UUID, _year SMALLINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.profiles SET year = _year WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'set_year', jsonb_build_object('year', _year));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_suspend(_user UUID, _days INT, _reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.profiles SET suspended_until = now() + (_days || ' days')::interval WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'suspend', jsonb_build_object('days', _days, 'reason', _reason));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_ban(_user UUID, _reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.profiles SET banned = true WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'ban', jsonb_build_object('reason', _reason));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_unban(_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.profiles SET banned = false, suspended_until = NULL, warning_count = 0 WHERE id = _user;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'unban', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_warn(_user UUID, _reason TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.user_warnings (user_id, reason, issued_by) VALUES (_user, _reason, auth.uid());
  UPDATE public.profiles SET warning_count = warning_count + 1 WHERE id = _user RETURNING warning_count INTO v_count;
  IF v_count >= 3 THEN
    UPDATE public.profiles SET suspended_until = now() + interval '7 days' WHERE id = _user;
  END IF;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'warn', jsonb_build_object('reason', _reason, 'count', v_count));
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'delete_user', '{}'::jsonb);
  DELETE FROM auth.users WHERE id = _user;
END; $$;
