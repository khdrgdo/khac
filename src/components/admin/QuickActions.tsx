import { Button } from "@/components/ui/button";
import { Users, FilePlus, BookOpen, ShieldAlert, Bell, Download } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { exportCsv } from "@/lib/exportCsv";

interface QuickAction {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
}

export function QuickActions() {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    { label: "إضافة مستخدم", icon: Users, onClick: () => navigate({ to: "/admin", search: { tab: "users" } }), variant: "default" },
    { label: "إضافة مقرر", icon: FilePlus, onClick: () => navigate({ to: "/admin", search: { tab: "courses" } }), variant: "secondary" },
    { label: "التقارير", icon: Bell, onClick: () => navigate({ to: "/admin", search: { tab: "reports" } }), variant: "outline" },
    { label: "المدرسون", icon: BookOpen, onClick: () => navigate({ to: "/admin", search: { tab: "teachers" } }), variant: "outline" },
    { label: "الأمن", icon: ShieldAlert, onClick: () => navigate({ to: "/admin", search: { tab: "banned" } }), variant: "outline" },
    { label: "تصدير البيانات", icon: Download, onClick: handleExport, variant: "ghost" },
  ];

  async function handleExport() {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: users } = await supabase.from("profiles").select("full_name, email, university_number, major, year");
      if (users?.length) exportCsv(users as any, "nexus_users_export");
    } catch {}
  }

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {actions.map((a) => (
        <Button key={a.label} variant={a.variant ?? "outline"} size="sm" onClick={a.onClick} className="gap-1.5 text-xs">
          <a.icon className="w-3.5 h-3.5" />
          {a.label}
        </Button>
      ))}
    </div>
  );
}
