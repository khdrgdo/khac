import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ActivityItem {
  id: string;
  type: "report" | "name_request" | "admin_action";
  description: string;
  time: string;
}

export function RecentActivity() {
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const limit = showAll ? 20 : 5;
      const items: ActivityItem[] = [];

      const [reportsRes, nameReqsRes, adminActionsRes] = await Promise.all([
        supabase.from("post_reports").select("id, reason, created_at").order("created_at", { ascending: false }).limit(limit),
        (supabase as unknown as { from: (t: string) => any }).from("name_change_requests").select("id, requested_name, status, created_at").order("created_at", { ascending: false }).limit(limit) as Promise<{ data: { id: string; requested_name: string; status: string; created_at: string }[] | null }>,
        supabase.from("admin_actions").select("id, action, created_at").order("created_at", { ascending: false }).limit(limit),
      ]);

      (reportsRes.data ?? []).forEach((r) => {
        items.push({
          id: r.id,
          type: "report",
          description: `بلاغ جديد: ${(r.reason || "").slice(0, 50) || "بدون سبب"}`,
          time: r.created_at,
        });
      });
      (nameReqsRes.data ?? []).forEach((r) => {
        items.push({
          id: r.id,
          type: "name_request",
          description: `طلب تغيير اسم ← "${r.requested_name}" (${r.status})`,
          time: r.created_at,
        });
      });
      (adminActionsRes.data ?? []).forEach((r) => {
        items.push({
          id: r.id,
          type: "admin_action",
          description: (r.action || "").slice(0, 60) || "إجراء إداري",
          time: r.created_at,
        });
      });

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return items.slice(0, limit);
    },
  });

  return (
    <Card className="border border-border/40 shadow-sm rounded-xl mb-8">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          النشاط الحديث
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={`w-3 h-3 ml-1 ${isRefetching ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </CardHeader>
      <CardContent className="pb-3">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary/50" /></div>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا توجد أنشطة حديثة</p>
        ) : (
          <div className="space-y-1">
            {data.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${item.type === "report" ? "bg-red-400" : item.type === "name_request" ? "bg-amber-400" : "bg-blue-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground/80 truncate">{item.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(item.time).toLocaleDateString("ar-SA", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.type === "report" ? "bg-red-50 text-red-600" : item.type === "name_request" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}>
                  {item.type === "report" ? "بلاغ" : item.type === "name_request" ? "تغيير اسم" : "إجراء"}
                </span>
              </div>
            ))}
          </div>
        )}
        <Button variant="link" size="sm" className="w-full mt-1 text-xs" onClick={() => { setShowAll((p) => !p); refetch(); }}>
          {showAll ? "عرض أقل" : "عرض المزيد"}
        </Button>
      </CardContent>
    </Card>
  );
}
