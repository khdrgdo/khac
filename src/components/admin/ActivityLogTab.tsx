import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";

export function ActivityLogTab() {
  return (
    <Card className="p-6 border-border/60 rounded-3xl text-center space-y-2">
      <Clock className="w-8 h-8 text-primary mx-auto" />
      <h3 className="font-bold text-base">سجل النشاط بالنظام</h3>
      <p className="text-xs text-muted-foreground">تتبع الأحداث والأنشطة الأخيرة بالنظام.</p>
    </Card>
  );
}
