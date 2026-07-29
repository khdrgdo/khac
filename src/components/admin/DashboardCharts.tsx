import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { Calendar } from "lucide-react";

export function DashboardCharts() {
  const barData = [
    { name: "01", value: 40 },
    { name: "02", value: 70 },
    { name: "03", value: 45 },
    { name: "04", value: 90 },
    { name: "05", value: 65 },
    { name: "06", value: 85 },
    { name: "07", value: 110 },
  ];

  const areaData = [
    { name: "1", value: 2000 },
    { name: "2", value: 4000 },
    { name: "3", value: 3000 },
    { name: "4", value: 8000 },
    { name: "5", value: 5000 },
    { name: "6", value: 12000 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <Card className="border border-border/40 shadow-sm rounded-xl bg-card overflow-hidden">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">إجمالي النشاط</p>
              <h3 className="text-2xl font-bold tracking-tight mt-1">1,525</h3>
              <p className="text-xs text-emerald-500 mt-1 font-medium">+20.3% منذ الشهر الماضي</p>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs bg-muted/30">
              <Calendar className="w-3.5 h-3.5 ml-1.5" /> آخر 30 يوماً
            </Button>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/40 shadow-sm rounded-xl bg-card overflow-hidden">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">التفاعل الكلي</p>
              <h3 className="text-2xl font-bold tracking-tight mt-1">20,462.89</h3>
              <p className="text-xs text-emerald-500 mt-1 font-medium">+20.1% منذ الشهر الماضي</p>
            </div>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#6366f1"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
