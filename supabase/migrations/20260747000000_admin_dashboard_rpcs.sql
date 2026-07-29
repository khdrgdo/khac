-- RPC: daily user registrations for the last N days
CREATE OR REPLACE FUNCTION public.get_daily_user_registrations(since timestamptz)
RETURNS TABLE(day text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT to_char(created_at, 'MM-DD') AS day, COUNT(*)::bigint AS count
  FROM profiles
  WHERE created_at >= since
  GROUP BY to_char(created_at, 'MM-DD')
  ORDER BY day;
$$;

-- RPC: daily posts for the last N days
CREATE OR REPLACE FUNCTION public.get_daily_posts(since timestamptz)
RETURNS TABLE(day text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT to_char(created_at, 'MM-DD') AS day, COUNT(*)::bigint AS count
  FROM posts
  WHERE created_at >= since
  GROUP BY to_char(created_at, 'MM-DD')
  ORDER BY day;
$$;

-- RPC: recent activity (last 10 admin actions + name requests + reports)
CREATE OR REPLACE FUNCTION public.get_recent_admin_activity()
RETURNS TABLE(
  id uuid,
  activity_type text,
  description text,
  created_at timestamptz,
  user_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- Admin actions
  SELECT a.id, 'admin_action'::text, a.action || ' - ' || COALESCE(p.full_name, ''), a.created_at, COALESCE(p.full_name, '')
  FROM admin_actions a
  LEFT JOIN profiles p ON a.target_user_id = p.id
  ORDER BY a.created_at DESC
  LIMIT 10;
$$;

-- RPC: all courses with material counts
CREATE OR REPLACE FUNCTION public.get_courses_with_counts()
RETURNS TABLE(
  id uuid,
  name text,
  major text,
  year smallint,
  semester smallint,
  teacher_name text,
  files_count bigint,
  links_count bigint,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id, c.name, c.major::text, c.year, c.semester,
    COALESCE(p.full_name, '') AS teacher_name,
    (SELECT COUNT(*) FROM course_links cl WHERE cl.course_id = c.id AND cl.link_type = 'file') AS files_count,
    (SELECT COUNT(*) FROM course_links cl WHERE cl.course_id = c.id AND (cl.link_type IS NULL OR cl.link_type = '')) AS links_count,
    c.created_at
  FROM courses c
  LEFT JOIN profiles p ON c.teacher_id = p.id
  ORDER BY c.created_at DESC;
$$;
