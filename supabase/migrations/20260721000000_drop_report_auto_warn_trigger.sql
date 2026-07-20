-- The reports queue is being rebuilt so every consequence (warn/suspend/ban/
-- delete post/dismiss) is an explicit admin decision made from the UI, via
-- admin_warn / admin_suspend / admin_ban (each already logs to
-- admin_actions). The existing trigger below fired an automatic warning the
-- instant a report's status flipped to 'confirmed', which both bypassed
-- admin choice and would double-count warnings once the UI also calls
-- admin_warn directly. Removing it makes "confirmed" a pure record-keeping
-- status with no side effects of its own.

DROP TRIGGER IF EXISTS trg_report_auto_warn ON public.post_reports;
DROP FUNCTION IF EXISTS public.on_report_auto_warn();
