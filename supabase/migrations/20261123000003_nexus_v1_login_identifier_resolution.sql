-- NEXUS 1.0.0 — resolve numeric login identifiers without exposing profile rows
-- Supports accounts created with real email addresses as well as legacy synthetic aliases.

BEGIN;

CREATE TABLE IF NOT EXISTS public.login_lookup_attempts (
    ip_hash text PRIMARY KEY,
    window_started_at timestamptz NOT NULL DEFAULT now(),
    attempts integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_lookup_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.login_lookup_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_login_email(_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_identifier text := trim(COALESCE(_identifier, ''));
    v_headers text;
    v_ip text := 'unknown';
    v_ip_hash text;
    v_attempts integer := 0;
    v_email text;
BEGIN
    -- This endpoint resolves numeric university numbers only. Email and
    -- sub-admin username login continue through their existing Auth aliases.
    IF v_identifier !~ '^[0-9]{5,20}$' THEN
        RETURN NULL;
    END IF;

    v_headers := current_setting('request.headers', true);

    IF v_headers IS NOT NULL THEN
        BEGIN
            v_ip := COALESCE(
                NULLIF(
                    split_part(
                        COALESCE(
                            v_headers::jsonb ->> 'x-forwarded-for',
                            v_headers::jsonb ->> 'x-real-ip',
                            'unknown'
                        ),
                        ',',
                        1
                    ),
                    ''
                ),
                'unknown'
            );
        EXCEPTION WHEN others THEN
            v_ip := 'unknown';
        END;
    END IF;

    -- Supabase's API gateway supplies the client IP in request.headers.
    -- If it is absent (e.g. local SQL tests), do not share one global bucket.
    IF v_ip <> 'unknown' THEN
        v_ip_hash := md5(v_ip);

        INSERT INTO public.login_lookup_attempts(
            ip_hash, window_started_at, attempts, updated_at
        )
        VALUES (v_ip_hash, now(), 1, now())
        ON CONFLICT (ip_hash)
        DO UPDATE SET
            attempts = CASE
                WHEN public.login_lookup_attempts.window_started_at < now() - interval '15 minutes'
                    THEN 1
                ELSE public.login_lookup_attempts.attempts + 1
            END,
            window_started_at = CASE
                WHEN public.login_lookup_attempts.window_started_at < now() - interval '15 minutes'
                    THEN now()
                ELSE public.login_lookup_attempts.window_started_at
            END,
            updated_at = now()
        RETURNING attempts INTO v_attempts;

        IF v_attempts > 12 THEN
            RAISE EXCEPTION 'Too many login lookup attempts. Try again later.';
        END IF;
    END IF;

    SELECT u.email
    INTO v_email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.university_number = v_identifier
    LIMIT 1;

    -- Do not return a profile, user ID, or whether the identifier exists.
    RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

COMMIT;
