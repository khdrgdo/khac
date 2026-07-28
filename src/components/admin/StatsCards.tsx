import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, BookOpen, MessageSquare, Bell } from "lucide-react";

export function StatsCards() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats-summary"],
    queryFn: async () => {
      const [
        { count: usersCount },
        { count: coursesCount },
        { count: postsCount },
        { count: notifsCount },
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("posts").select("id", { count: "exact", head: true }),
        supabase.from("notifications").select("id", { count: "exact", head: true }),
      ]);

      return {
        users: usersCount ?? 0,
        courses: coursesCount ?? 0,
        posts: postsCount ?? 0,
        notifs: notifsCount ?? 0,
      };
    },
  });

  const cards = [
    { title: "إجمالي الطلاب", count: stats?.users ?? 0, icon: <Users className="w-5 h-5 text-indigo-500" />, bg: "bg-indigo-500/10 text-indigo-500" },
    { title: "المواد الدراسية", count: stats?.courses ?? 0, icon: <BookOpen className="w-5 h-5 text-emerald-500" />, bg: "bg-emerald-500/10 text-emerald-500" },
    { title: "المنشورات والتفاعلات", count: stats?.posts ?? 0, icon: <MessageSquare className="w-5 h-5 text-purple-500" />, bg: "bg-purple-500/10 text-purple-500" },
    { title: "الإشعارات المرسلة", count: stats?.notifs ?? 0, icon: <Bell className="w-5 h-5 text-amber-500" />, bg: "bg-amber-500/10 text-amber-500" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => (
        <div key={i} className="bg-card border border-border/60 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">{c.title}</span>
            <div className={`p-2.5 rounded-xl ${c.bg}`}>{c.icon}</div>
          </div>
          <div className="text-2xl font-black text-foreground">{c.count}</div>
        </div>
      ))}
    </div>
  );
}
