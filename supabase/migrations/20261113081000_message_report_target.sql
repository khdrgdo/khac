-- Store the exact message targeted by a moderation report when the report is message-specific.
ALTER TABLE public.message_reports
  ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;
