import { Card } from "@/components/ui/card";
import { UserCheck } from "lucide-react";

export function SubAdminsTab() {
  return (
    <Card className="p-6 border-border/60 rounded-3xl text-center space-y-2">
      <UserCheck className="w-8 h-8 text-indigo-500 mx-auto" />
      <h3 className="font-bold text-base">حسابات المساعدين والصلاحيات</h3>
      <p className="text-xs text-muted-foreground">تعيين مشرفين مساعدين وتحديد الصلاحيات المخصصة.</p>
    </Card>
  );
}
