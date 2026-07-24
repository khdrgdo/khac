CREATE TABLE name_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_name TEXT NOT NULL,
    requested_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    contact_info TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

ALTER TABLE name_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own name change requests"
ON name_change_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own name change requests"
ON name_change_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all name change requests"
ON name_change_requests FOR SELECT
USING (public.has_role('admin', auth.uid()) OR public.has_role('sub_admin', auth.uid()));

CREATE POLICY "Admins can update name change requests"
ON name_change_requests FOR UPDATE
USING (public.has_role('admin', auth.uid()) OR public.has_role('sub_admin', auth.uid()));

-- Also add hide_university_number to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hide_university_number BOOLEAN NOT NULL DEFAULT false;


ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_used_direct_name_change BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE name_change_requests ADD COLUMN IF NOT EXISTS university_number TEXT;
