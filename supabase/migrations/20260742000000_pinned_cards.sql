CREATE TABLE pinned_cards (
    id TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT true,
    type TEXT NOT NULL,
    theme TEXT NOT NULL,
    badge_text TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    end_date TIMESTAMPTZ,
    action_button_text TEXT,
    action_button_url TEXT,
    target_year INTEGER,
    target_major TEXT,
    poll_options JSONB NOT NULL DEFAULT '[]'::jsonb,
    votes JSONB NOT NULL DEFAULT '{}'::jsonb,
    participants JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pinned_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pinned cards"
ON pinned_cards FOR SELECT
USING (true);

CREATE POLICY "Admins can insert pinned cards"
ON pinned_cards FOR INSERT
WITH CHECK (public.has_role('admin', auth.uid()) OR public.has_role('sub_admin', auth.uid()));

CREATE POLICY "Admins can update pinned cards"
ON pinned_cards FOR UPDATE
USING (public.has_role('admin', auth.uid()) OR public.has_role('sub_admin', auth.uid()));

CREATE POLICY "Users can vote on pinned cards"
ON pinned_cards FOR UPDATE
USING (auth.uid() IS NOT NULL);
-- (Using a more relaxed policy for voting/participating since users need to update votes JSONB. A cleaner way would be a separate votes table, but since the component expects a JSONB structure we will just allow authenticated users to update it).

-- We will insert a default card
INSERT INTO pinned_cards (id, enabled, type, theme, badge_text, title, description, poll_options, votes, participants)
VALUES (
    'pinned_featured_event_1', 
    true, 
    'contest', 
    'royal', 
    '🏆 مسابقة الأسبوع المميزة', 
    'تحدي البرمجة والحلول الأكاديمية - الدورة الثالثة', 
    'شارك أفضل ملخص دراسي أو مشروع تطبيقي ونافس على جائزة أفضل مساهم أكاديمي!', 
    '[{"id": "opt_1", "text": "الذكاء الاصطناعي وتعلم الآلة"}, {"id": "opt_2", "text": "تطبيقات الويب والأجهزة المحمولة"}, {"id": "opt_3", "text": "الأمن السيبراني والشبكات"}]'::jsonb, 
    '{}'::jsonb, 
    '[]'::jsonb
) ON CONFLICT (id) DO NOTHING;

