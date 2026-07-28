import { Card } from "@/components/ui/card";
import { Flag } from "lucide-react";

export function ReportsTab() {
  return (
    <Card className="p-6 border-border/60 rounded-3xl text-center space-y-2">
      <Flag className="w-8 h-8 text-amber-500 mx-auto" />
      <h3 className="font-bold text-base">قسم البلاغات والملاحظات</h3>
      <p className="text-xs text-muted-foreground">لا توجد بلاغات معلقة حالياً.</p>
    </Card>
  );
}
