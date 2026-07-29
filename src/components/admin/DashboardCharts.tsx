import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function DashboardCharts() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-charts-real"],
    queryFn: async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [majorsRes, yearRes] = await Promise.all([
        supabase.from("profiles").select("major"),
        supabase.from("profiles").select("year"),
      ]);

      // Try RPCs, fallback to raw queries
      let dailyUsers: { day: string; count: number }[] = [];
      let dailyPosts: { day: string; count: number }[] = [];

      try {
        const r1 = await (supabase.rpc as any)("get_daily_user_registrations", { since: thirtyDaysAgo });
        if (!r1.error) dailyUsers = (r1.data ?? []) as any;
      } catch { /* rpc not available */ }

      if (dailyUsers.length === 0) {
        const { data } = await supabase
          .from("profiles")
          .select("created_at")
          .gte("created_at", thirtyDaysAgo)
          .order("created_at");
        if (data) {
          const map: Record<string, number> = {};
          data.forEach((p) => {
            const d = new Date(p.created_at).toISOString().slice(5, 10);
            map[d] = (map[d] || 0) + 1;
          });
          dailyUsers = Object.entries(map).map(([day, count]) => ({ day, count }));
        }
      }

      try {
        const r2 = await (supabase.rpc as any)("get_daily_posts", { since: thirtyDaysAgo });
        if (!r2.error) dailyPosts = (r2.data ?? []) as any;
      } catch { /* rpc not available */ }

      if (dailyPosts.length === 0) {
        const { data } = await supabase
          .from("posts")
          .select("created_at")
          .gte("created_at", thirtyDaysAgo)
          .order("created_at");
        if (data) {
          const map: Record<string, number> = {};
          data.forEach((p) => {
            const d = new Date(p.created_at).toISOString().slice(5, 10);
            map[d] = (map[d] || 0) + 1;
          });
          dailyPosts = Object.entries(map).map(([day, count]) => ({ day, count }));
        }
      }

      return {
        dailyUsers,
        dailyPosts,
        majors: (majorsRes.data ?? []) as { major: string | null }[],
        years: (yearRes.data ?? []) as { year: number | null }[],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
      </div>
    );
  }

  const majorCount: Record<string, number> = {};
  (data?.majors ?? []).forEach((p) => {
    const m = p.major || "unknown";
    majorCount[m] = (majorCount[m] || 0) + 1;
  });
  const majorPie = Object.entries(majorCount).map(([name, value]) => ({ name, value }));

  const yearCount: Record<string, number> = {};
  (data?.years ?? []).forEach((p) => {
    const y = p.year ? String(p.year) : "unknown";
    yearCount[y] = (yearCount[y] || 0) + 1;
  });
  const yearPie = Object.entries(yearCount).map(([name, value]) => ({ name, value }));

  const barData = (data?.dailyUsers ?? []).slice(-14);
  const areaData = (data?.dailyPosts ?? []).slice(-14);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <Card className="border border-border/40 shadow-sm rounded-xl bg-card overflow-hidden">
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground mb-4">المستخدمون الجدد (آخر 14 يوم)</p>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} name="المستخدمون" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/40 shadow-sm rounded-xl bg-card overflow-hidden">
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground mb-4">المنشورات اليومية (آخر 14 يوم)</p>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPosts)" name="المنشورات" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/40 shadow-sm rounded-xl bg-card overflow-hidden">
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground mb-4">توزيع المستخدمين حسب التخصص</p>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={majorPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                  {majorPie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend formatter={(v: string) => (v === "it" ? "تقنية معلومات" : v === "is" ? "نظم معلومات" : v === "se" ? "هندسة برمجيات" : v === "unknown" ? "غير محدد" : v)} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/40 shadow-sm rounded-xl bg-card overflow-hidden">
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground mb-4">توزيع المستخدمين حسب السنة الدراسية</p>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={yearPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                  {yearPie.map((_, i) => (
                    <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <Legend formatter={(v: string) => (v === "unknown" ? "غير محدد" : `السنة ${v}`)} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
