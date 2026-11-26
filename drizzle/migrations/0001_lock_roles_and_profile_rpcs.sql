CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_univ TEXT; v_name TEXT; v_major public.major_code; v_year SMALLINT;
BEGIN
  v_univ := COALESCE(NEW.raw_user_meta_data->>'university_number', '');
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'مستخدم');
  BEGIN v_major := (NEW.raw_user_meta_data->>'major')::public.major_code; EXCEPTION WHEN OTHERS THEN v_major := NULL; END;
  BEGIN v_year := (NEW.raw_user_meta_data->>'year')::SMALLINT; EXCEPTION WHEN OTHERS THEN v_year := NULL; END;
  IF v_univ = '' THEN v_univ := 'U' || substr(NEW.id::text, 1, 8); END IF;
  INSERT INTO public.profiles (id, university_number, full_name, major, year, email, must_change_password)
  VALUES (NEW.id, v_univ, v_name, v_major, v_year, NEW.email, COALESCE((NEW.raw_user_meta_data->>'must_change_password')::BOOLEAN, false))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user uuid, _role app_role)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _user = auth.uid() THEN RAISE EXCEPTION 'cannot change your own role via this function'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user, _role);
  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'set_role', jsonb_build_object('role', _role));
END; $function$;

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND cmd IN ('INSERT','UPDATE','DELETE','ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.user_roles', r.policyname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.search_public_profiles(_q text)
 RETURNS TABLE(id uuid, full_name text, university_number text, avatar_url text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_me uuid := auth.uid(); v_main boolean;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  v_main := public.is_main_admin(v_me);
  RETURN QUERY
  SELECT p.id, p.full_name,
    CASE WHEN COALESCE(p.hide_university_number,false) AND p.id <> v_me AND NOT v_main THEN NULL ELSE p.university_number END,
    p.avatar_url
  FROM public.profiles p
  LEFT JOIN public.user_roles r ON p.id = r.user_id AND r.role = 'sub_admin'
  WHERE (p.full_name ILIKE '%' || _q || '%'
         OR (p.university_number ILIKE '%' || _q || '%'
             AND (NOT COALESCE(p.hide_university_number,false) OR p.id = v_me OR v_main)))
    AND (r.user_id IS NULL OR p.id = v_me OR public.has_role(v_me, 'admin'::public.app_role))
  LIMIT 20;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
 RETURNS TABLE(id uuid, full_name text, avatar_url text, major major_code, year smallint, bio text, points integer, university_number text, verified boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_me uuid := auth.uid(); v_main boolean;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  v_main := public.is_main_admin(v_me);
  RETURN QUERY
  SELECT p.id, p.full_name, p.avatar_url, p.major, p.year, p.bio, p.points,
    CASE WHEN COALESCE(p.hide_university_number,false) AND p.id <> v_me AND NOT v_main THEN NULL ELSE p.university_number END,
    p.verified
  FROM public.profiles p
  LEFT JOIN public.user_roles r ON p.id = r.user_id AND r.role = 'sub_admin'
  WHERE p.id = ANY(_ids)
    AND (r.user_id IS NULL OR p.id = v_me OR public.has_role(v_me, 'admin'::public.app_role));
END; $function$;

CREATE OR REPLACE FUNCTION public.get_leaderboard_profiles(_major major_code DEFAULT NULL::major_code, _year smallint DEFAULT NULL::smallint)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, major major_code, year smallint, points integer, university_number text, verified boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_me uuid := auth.uid(); v_main boolean;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  v_main := public.is_main_admin(v_me);
  RETURN QUERY
  SELECT p.id, p.full_name, p.avatar_url, p.major, p.year, p.points,
    CASE WHEN COALESCE(p.hide_university_number,false) AND p.id <> v_me AND NOT v_main THEN NULL ELSE p.university_number END,
    p.verified
  FROM public.profiles p
  WHERE (_major IS NULL OR p.major = _major) AND (_year IS NULL OR p.year = _year)
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role IN ('admin','sub_admin'))
  ORDER BY p.points DESC LIMIT 50;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.search_public_profiles(text), public.get_public_profiles(uuid[]), public.get_leaderboard_profiles(major_code, smallint), public.admin_set_user_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text), public.get_public_profiles(uuid[]), public.get_leaderboard_profiles(major_code, smallint), public.admin_set_user_role(uuid, app_role) TO authenticated;