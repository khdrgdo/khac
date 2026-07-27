const fs = require('fs');
const path = require('path');

const ADMIN = path.join(process.env.TEMP || '/tmp', 'nexus_fix', 'src', 'routes', '_authenticated', 'admin.tsx');
const content = fs.readFileSync(ADMIN, 'utf8');
const lines = content.split('\n');

function extractLines(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

// Create admin components directory
const DIR = path.join(process.env.TEMP || '/tmp', 'nexus_fix', 'src', 'components', 'admin');
fs.mkdirSync(DIR, { recursive: true });

// 1. admin-shared.ts — shared types, utilities, hooks
const sharedTypes = `import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Badge as BadgeType } from "lucide-react";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type AdminActionRow = Database["public"]["Tables"]["admin_actions"]["Row"];
export type UserWarningRow = Database["public"]["Tables"]["user_warnings"]["Row"];

export interface LastActivityMap {
  [userId: string]: string;
}

export function userStatus(
  u: Pick<ProfileRow, "banned" | "suspended_until">,
): "banned" | "suspended" | "active" {
  if (u.banned) return "banned";
  if (u.suspended_until && new Date(u.suspended_until) > new Date()) return "suspended";
  return "active";
}

export function StatusBadge({ status }: { status: "banned" | "suspended" | "active" }) {
  if (status === "banned") return <Badge variant="destructive">محظور</Badge>;
  if (status === "suspended")
    return (
      <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400">
        موقوف
      </Badge>
    );
  return (
    <Badge
      variant="secondary"
      className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400"
    >
      نشط
    </Badge>
  );
}

export function useSubAdminRestrictions() {
  const { profile, isSubAdmin } = useAuth();
  const currentUserId = profile?.id;

  const selfBan = useMutation({
    mutationFn: async () => {
      if (!currentUserId) return;
      const { error } = await supabase.rpc("admin_ban", {
        _user: currentUserId,
        _reason: "محاولة التعديل على حساب الأدمن الرسمي",
      });
      if (error) {
        await supabase
          .from("profiles")
          .update({ banned: true, bio: "محظور تلقائياً لمحاولة التعديل على حساب الأدمن الرسمي" })
          .eq("id", currentUserId);
      }
      await supabase.auth.signOut();
      window.location.reload();
    },
  });

  function isTargetMainAdmin(u: { university_number: string; email?: string | null }) {
    return u.university_number === "2011099840" || u.university_number === "HIDDEN_2011099840" || u.email?.toLowerCase() === "khdrmamon@gmail.com";
  }

  function handleActionCheck(target: { university_number: string; email?: string | null }) {
    if (isSubAdmin && isTargetMainAdmin(target)) {
      toast.error(
        "⚠️ محاولة محظورة! تم رصد محاولة تعديل على حساب الأدمن الرسمي. سيتم حظر حسابك وتسجيل خروجك فوراً.",
      );
      selfBan.mutate();
      throw new Error("Violation: Sub-admin tried to modify main admin");
    }
  }

  return { handleActionCheck, isSubAdmin };
}
`;
fs.writeFileSync(path.join(DIR, 'admin-shared.tsx'), sharedTypes, 'utf8');
console.log('Created admin-shared.tsx');

// 2. DashboardCharts.tsx
const dashboardCharts = `import { Card, CardContent } from "@/components/ui/card";
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

${extractLines(410, 516)}
`;
fs.writeFileSync(path.join(DIR, 'DashboardCharts.tsx'), dashboardCharts, 'utf8');
console.log('Created DashboardCharts.tsx');

// 3. StatsCards.tsx
const statsCards = `import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Users, FileText, Flag, MessageSquare } from "lucide-react";

${extractLines(518, 601)}
`;
fs.writeFileSync(path.join(DIR, 'StatsCards.tsx'), statsCards, 'utf8');
console.log('Created StatsCards.tsx');

// 4. ReportsTab.tsx
const reportsTab = `import { useState } from "react";
import { renderMarkdownContent } from "@/lib/markdown";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { useSubAdminRestrictions } from "@/components/admin/admin-shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Flag, FileText, Plus, Minus, Check, X, Trash2, Ban, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

${extractLines(603, 981)}
`;
fs.writeFileSync(path.join(DIR, 'ReportsTab.tsx'), reportsTab, 'utf8');
console.log('Created ReportsTab.tsx');

// 5. UsersTable.tsx (includes UserDetailsDialog)
const usersTable = `import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { useSubAdminRestrictions, type ProfileRow, type UserWarningRow, type LastActivityMap, userStatus, StatusBadge } from "@/components/admin/admin-shared";
import { formatUnivNumber } from "@/lib/privacy";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  Loader2,
  Users,
  Search,
  Check,
  X,
  Trash2,
  Eye,
  GraduationCap,
  Ban,
  AlertTriangle,
  ShieldOff,
  BadgeCheck,
  MoreVertical,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { majorLabel } from "@/lib/college";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { RankBadge } from "@/components/RankBadge";
import { renderMarkdownContent } from "@/lib/markdown";

${extractLines(983, 1889)}
`;
fs.writeFileSync(path.join(DIR, 'UsersTable.tsx'), usersTable, 'utf8');
console.log('Created UsersTable.tsx');

// 6. ActivityLogTab.tsx
const activityLogTab = `import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatUnivNumber } from "@/lib/privacy";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Users, Shield, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { majorLabel } from "@/lib/college";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { formatArabicTimeAgo } from "@/lib/notificationsStore";

${extractLines(1891, 2375)}
`;
fs.writeFileSync(path.join(DIR, 'ActivityLogTab.tsx'), activityLogTab, 'utf8');
console.log('Created ActivityLogTab.tsx');

// 7. AddTeacherCard.tsx
const addTeacherCard = `import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

${extractLines(2379, 2551)}
`;
fs.writeFileSync(path.join(DIR, 'AddTeacherCard.tsx'), addTeacherCard, 'utf8');
console.log('Created AddTeacherCard.tsx');

// 8. BannedWordsTab.tsx
const bannedWordsTab = `import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

${extractLines(2555, 2613)}
`;
fs.writeFileSync(path.join(DIR, 'BannedWordsTab.tsx'), bannedWordsTab, 'utf8');
console.log('Created BannedWordsTab.tsx');

// 9. SubAdminsTab.tsx
const subAdminsTab = `import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { serializeSubAdminPermissions, type SubAdminPermissions } from "@/hooks/useAuth";
import { createIsolatedSupabaseClient } from "@/lib/isolatedSupabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserPlus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

${extractLines(2615, 3182)}
`;
fs.writeFileSync(path.join(DIR, 'SubAdminsTab.tsx'), subAdminsTab, 'utf8');
console.log('Created SubAdminsTab.tsx');

// 10. NameRequestsTab.tsx
const nameRequestsTab = `import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatUnivNumber } from "@/lib/privacy";
import {
  getNameChangeRequests,
  approveNameChangeRequest,
  rejectNameChangeRequest,
  type NameChangeRequest,
} from "@/lib/nameChangeRequests";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatArabicTimeAgo } from "@/lib/notificationsStore";

${extractLines(3184, 3384)}
`;
fs.writeFileSync(path.join(DIR, 'NameRequestsTab.tsx'), nameRequestsTab, 'utf8');
console.log('Created NameRequestsTab.tsx');

// 11. Rewrite admin.tsx as slim orchestrator
const orchestrator = `import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Sparkles, UserCheck, Bell, Calendar, Download } from "lucide-react";
import { BroadcastNotificationTab } from "@/components/BroadcastNotificationTab";
import { PinnedCardAdminTab } from "@/components/PinnedCardAdminTab";
import { DashboardCharts } from "@/components/admin/DashboardCharts";
import { StatsCards } from "@/components/admin/StatsCards";
import { ReportsTab } from "@/components/admin/ReportsTab";
import { UsersTable } from "@/components/admin/UsersTable";
import { ActivityLogTab } from "@/components/admin/ActivityLogTab";
import { AddTeacherCard } from "@/components/admin/AddTeacherCard";
import { BannedWordsTab } from "@/components/admin/BannedWordsTab";
import { SubAdminsTab } from "@/components/admin/SubAdminsTab";
import { NameRequestsTab } from "@/components/admin/NameRequestsTab";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, isMainAdmin, isSubAdmin, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/feed", replace: true });
  }, [loading, isAdmin, navigate]);

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
      </div>
    );
  if (!isAdmin) return null;

  const permissions = getSubAdminPermissions(profile);

  const showReports = !isSubAdmin || permissions.can_reports;
  const showLog = !isSubAdmin;
  const showTeacher = !isSubAdmin || permissions.can_teachers;
  const showWords = !isSubAdmin || permissions.can_words;
  const showSubAdmins = isMainAdmin;

  const defaultTab = showReports ? "reports" : "users";

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12 pt-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm mb-2">
              <Sparkles className="mr-2 h-4 w-4" />
              ميزات الإدارة المتقدمة
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isSubAdmin ? "لوحة المشرف المساعد" : "لوحة الإدارة الشاملة"}
            </h1>
            <p className="text-white/80 max-w-xl">
              {isSubAdmin
                ? "تتيح لك هذه اللوحة إدارة الصلاحيات المخصصة لك ومتابعة نشاط النظام ضمن النطاق المسموح."
                : "راقب الإحصائيات في الوقت الفعلي، وتتبع المبيعات والتقارير، وأدِر المستخدمين بكفاءة عالية للحصول على رؤى غير محدودة."}
            </p>
          </div>
          <Button
            variant="secondary"
            className="whitespace-nowrap bg-white text-indigo-600 hover:bg-white/90"
          >
            ترقية للنظام الاحترافي
          </Button>
        </div>
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute left-0 bottom-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"></div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight">نظرة عامة</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-card text-xs text-muted-foreground h-8 border-border/40">
            <Calendar className="w-3.5 h-3.5 ml-2" /> آخر 30 يوماً
          </Button>
          <Button variant="outline" size="sm" className="bg-card text-xs text-muted-foreground h-8 border-border/40">
            <Download className="w-3.5 h-3.5 ml-2" /> تصدير
          </Button>
        </div>
      </div>

      <StatsCards />
      <DashboardCharts />

      <div className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">إدارة النظام</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-card text-xs text-muted-foreground h-8 border-border/40">
              <Calendar className="w-3.5 h-3.5 ml-2" /> آخر 30 يوماً
            </Button>
            <Button variant="outline" size="sm" className="bg-card text-xs text-muted-foreground h-8 border-border/40">
              <Download className="w-3.5 h-3.5 ml-2" /> تصدير
            </Button>
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="flex flex-col gap-4 w-full items-start">
          <div className="w-full border-b border-border/40">
            <TabsList className="flex flex-row h-auto w-full justify-start bg-transparent p-0 gap-8 overflow-x-auto shrink-0 pb-px">
              {showReports && (
                <TabsTrigger value="reports" className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors">
                  البلاغات
                </TabsTrigger>
              )}
              <TabsTrigger value="users" className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors">
                المستخدمون
              </TabsTrigger>
              {showLog && (
                <TabsTrigger value="log" className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors">
                  سجل النشاط
                </TabsTrigger>
              )}
              {showTeacher && (
                <TabsTrigger value="teacher" className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors">
                  الأساتذة
                </TabsTrigger>
              )}
              {showWords && (
                <TabsTrigger value="words" className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors">
                  الكلمات المحظورة
                </TabsTrigger>
              )}
              {showSubAdmins && (
                <TabsTrigger value="subadmins" className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors">
                  حسابات المساعدين
                </TabsTrigger>
              )}
              <TabsTrigger value="pinned_card" className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>الكارد المثبت والأحداث</span>
              </TabsTrigger>
              <TabsTrigger value="broadcast_notif" className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-primary" />
                <span>إرسال إشعار للطلاب</span>
              </TabsTrigger>
              <TabsTrigger value="name_requests" className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                <span>طلبات تغيير الأسماء</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 w-full min-w-0">
            {showReports && (
              <TabsContent value="reports" className="mt-0 focus-visible:outline-none">
                <ReportsTab />
              </TabsContent>
            )}
            <TabsContent value="users" className="mt-0 focus-visible:outline-none">
              <UsersTable />
            </TabsContent>
            {showLog && (
              <TabsContent value="log" className="mt-0 focus-visible:outline-none">
                <ActivityLogTab />
              </TabsContent>
            )}
            {showTeacher && (
              <TabsContent value="teacher" className="mt-0 focus-visible:outline-none">
                <AddTeacherCard />
              </TabsContent>
            )}
            {showWords && (
              <TabsContent value="words" className="mt-0 focus-visible:outline-none">
                <BannedWordsTab />
              </TabsContent>
            )}
            {showSubAdmins && (
              <TabsContent value="subadmins" className="mt-0 focus-visible:outline-none">
                <SubAdminsTab />
              </TabsContent>
            )}
            <TabsContent value="pinned_card" className="mt-0 focus-visible:outline-none">
              <PinnedCardAdminTab />
            </TabsContent>
            <TabsContent value="broadcast_notif" className="mt-0 focus-visible:outline-none">
              <BroadcastNotificationTab />
            </TabsContent>
            <TabsContent value="name_requests" className="mt-0 focus-visible:outline-none">
              <NameRequestsTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(ADMIN, orchestrator, 'utf8');
console.log('Rewrote admin.tsx as slim orchestrator');

console.log('\nDone! Admin panel split into 10 files + orchestrator.');
