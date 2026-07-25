-- ProfileCardFrame.tsx tries to persist the user's chosen profile-card
-- theme via `profiles.update({ theme: themeId })`, but no such column has
-- ever existed on profiles — that update has been failing at runtime with
-- "column theme does not exist" (or, before that, the theme was silently
-- localStorage-only and never visible to anyone else viewing the profile).
-- This adds the real column so the choice persists and is visible to
-- everyone, not just the person who picked it on their own device.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme text;
