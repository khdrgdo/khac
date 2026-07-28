import { Card } from "@/components/ui/card";
import { BarChart3, TrendingUp } from "lucide-react";

export function DashboardCharts() {
  return (
    <Card className="p-6 border-border/60 rounded-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-500" />
          <h3 className="font-bold text-base text-foreground">نشاط المنصة الأكاديمية</h3>
        </div>
        <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" /> أداء مستقر
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        يتم متابعة كافة العمليات التفاعلية والإشعارات والمواد الأكاديمية لحظة بلحظة.
      </p>
    </Card>
  );
}
