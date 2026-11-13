-- Extend the existing reaction enum for the complete Facebook-style reaction set.
-- Additive and safe to re-run; deployment is separate from building the APK.
ALTER TYPE public.reaction_type ADD VALUE IF NOT EXISTS 'care';
ALTER TYPE public.reaction_type ADD VALUE IF NOT EXISTS 'angry';
