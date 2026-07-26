import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Users, FileText, Flag, MessageSquare } from "lucide-react";

export function StatsCards() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [{ count: users }, { count: posts }, { count: reports }, { count: msgs }] =
        await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("posts").select("*", { count: "exact", head: true }),
          supabase
            .from("post_reports")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase.from("messages").select("*", { count: "exact", head: true }),
        ]);
      return { users: users ?? 0, posts: posts ?? 0, reports: reports ?? 0, msgs: msgs ?? 0 };
    },
  });

  const items = [
    {
      icon: Users,
      label: "إجمالي المستخدمين",
      value: data?.users ?? 0,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      trend: "+41% منذ الشهر الماضي",
    },
    {
      icon: FileText,
      label: "إجمالي المنشورات",
      value: data?.posts ?? 0,
      color: "text-blue-600",
      bg: "bg-blue-50",
      trend: "+41% منذ الشهر الماضي",
    },
    {
      icon: Flag,
      label: "البلاغات المعلقة",
      value: data?.reports ?? 0,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      trend: "-50% منذ الشهر الماضي",
      trendDown: true,
    },
    {
      icon: MessageSquare,
      label: "إجمالي الرسائل",
      value: data?.msgs ?? 0,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      trend: "+41% منذ الشهر الماضي",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((it) => (
        <Card
          key={it.label}
          className="border border-border/40 shadow-sm rounded-xl bg-card hover:shadow-md transition-shadow duration-200"
        >
          <CardContent className="p-5 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${it.bg} ${it.color}`}
              >
                <it.icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">{it.label}</span>
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {it.value.toLocaleString()}
            </div>
            <div
              className={`text-xs mt-2 font-medium ${it.trendDown ? "text-rose-500" : "text-emerald-500"}`}
            >
              {it.trend}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
