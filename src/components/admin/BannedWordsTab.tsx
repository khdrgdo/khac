import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export function BannedWordsTab() {
  return (
    <Card className="p-6 border-border/60 rounded-3xl text-center space-y-2">
      <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto" />
      <h3 className="font-bold text-base">إدارة الكلمات المحظورة</h3>
      <p className="text-xs text-muted-foreground">تصفية النصوص التلقائية لضمان سلامة المحتوى.</p>
    </Card>
  );
}
