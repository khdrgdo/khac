-- Drop the old signature that uses the custom app_role enum type to prevent PostgREST / Supabase schema cache mismatch issues
DROP FUNCTION IF EXISTS public.admin_set_user_role(_user UUID, _role public.app_role);

-- Create the new signature that uses a robust TEXT type, casting it internally to the app_role enum
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user UUID, _role TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only main admin can call general set role (sub-admins cannot elevate roles or change roles generally)
  IF NOT public.is_main_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  
  IF _user = auth.uid() THEN 
    RAISE EXCEPTION 'cannot change your own role via this function'; 
  END IF;

  -- replace any existing role rows for this user with the single new role
  DELETE FROM public.user_roles WHERE user_id = _user;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user, _role::public.app_role);

  INSERT INTO public.admin_actions (admin_id, target_user_id, action, details)
    VALUES (auth.uid(), _user, 'set_role', jsonb_build_object('role', _role));
END; $$;

-- Grant execution to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO service_role;
