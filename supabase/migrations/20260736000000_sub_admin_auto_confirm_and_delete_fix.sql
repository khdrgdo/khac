-- 1. Upgrade public.is_main_admin to check JWT first for immediate authorization
CREATE OR REPLACE FUNCTION public.is_main_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_univ TEXT;
  v_email TEXT;
BEGIN
  -- Check current authenticated user email directly from the JWT for instant robustness
  IF auth.jwt() ->> 'email' = 'khdrmamon@gmail.com' THEN
    RETURN TRUE;
  END IF;

  -- Fallback to profiles table
  SELECT university_number, email INTO v_univ, v_email FROM public.profiles WHERE id = _user_id;
  RETURN COALESCE(v_univ, '') = '2011099840' OR LOWER(COALESCE(v_email, '')) = 'khdrmamon@gmail.com';
END; $$;

-- 2. Trigger to automatically confirm sub-admin and test accounts
CREATE OR REPLACE FUNCTION public.auto_confirm_subadmin_users()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email LIKE '%@subadmin.edu' OR COALESCE(NEW.raw_user_meta_data->>'university_number', '') LIKE 'sub_%' THEN
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_confirm_subadmin ON auth.users;
CREATE TRIGGER trg_auto_confirm_subadmin
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_subadmin_users();

-- 3. Auto-confirm any existing sub-admins in the database immediately
UPDATE auth.users
SET email_confirmed_at = now(), confirmed_at = now()
WHERE (email LIKE '%@subadmin.edu' OR COALESCE(raw_user_meta_data->>'university_number', '') LIKE 'sub_%')
  AND (email_confirmed_at IS NULL OR confirmed_at IS NULL);
