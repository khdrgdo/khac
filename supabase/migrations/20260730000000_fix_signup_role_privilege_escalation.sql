-- CRITICAL SECURITY FIX: self-service privilege escalation via signup.
--
-- handle_new_user() previously trusted the client-supplied `role` field in
-- auth signup metadata directly: any anonymous visitor could call the
-- Supabase signup API with {"data": {"role": "admin"}} (bypassing the
-- website's UI entirely, which only ever showed 'student'/'teacher') and
-- receive full admin privileges immediately upon registration, with zero
-- verification.
--
-- Fix: handle_new_user() now ALWAYS assigns 'student' on signup, ignoring
-- any role value in metadata entirely. A new admin_set_user_role() RPC lets
-- an authenticated admin explicitly promote a user afterward (used by the
-- "add teacher" flow in the admin dashboard, which creates the account via
-- normal signup and then immediately calls this RPC to grant 'teacher').

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_univ TEXT; v_name TEXT; v_major public.major_code; v_year SMALLINT;
BEGIN
  v_univ := COALESCE(NEW.raw_user_meta_data->>'university_number', '');
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'مستخدم');
  BEGIN v_major := (NEW.raw_user_meta_data->>'major')::public.major_code; EXCEPTION WHEN OTHERS THEN v_major := NULL; END;
  BEGIN v_year := (NEW.raw_user_meta_data->>'year')::SMALLINT; EXCEPTION WHEN OTHERS THEN v_year := NULL; END;

  IF v_univ = '' THEN v_univ := 'U' || substr(NEW.id::text, 1, 8); END IF;

  INSERT INTO public.profiles (id, university_number, full_name, major, year, email, must_change_password)
  VALUES (NEW.id, v_univ, v_name, v_major, v_year, NEW.email, COALESCE((NEW.raw_user_meta_data->>'must_change_password')::BOOLEAN, false))
  ON CONFLICT (id) DO NOTHING;

  -- SECURITY: always 'student' — never trust a client-supplied role from
  -- signup metadata. Promotion to 'teacher'/'admin' must go through
  -- admin_set_user_role(), callable only by an existing admin.
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user UUID, _role public.app_role)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _user = auth.uid() THEN RAISE EXCEPTION 'cannot change your own role via this function'; END IF;

  -- replace any existing role rows for this user with the single new role
  DELETE FROM public.user_roles WHERE user_id = _user;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user, _role);

  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'set_role', jsonb_build_object('role', _role));
END; $$;
