import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect } from "react";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Sparkles, UserCheck, Bell } from "lucide-react";
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
import { AdminSearch } from "@/components/admin/AdminSearch";
import { QuickActions } from "@/components/admin/QuickActions";
import { RecentActivity } from "@/components/admin/RecentActivity";
import { CoursesManagementTab } from "@/components/admin/CoursesManagementTab";

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
            onClick={() => toast.info("قريباً")}
          >
            ترقية للنظام الاحترافي
          </Button>
        </div>
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute left-0 bottom-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"></div>
      </div>

      <AdminSearch />

      <QuickActions />

      <h2 className="text-xl font-bold tracking-tight">نظرة عامة</h2>

      <StatsCards />
      <DashboardCharts />

      <RecentActivity />

      <div className="pt-4 space-y-4">
        <h2 className="text-xl font-bold tracking-tight">إدارة النظام</h2>

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
              {!isSubAdmin && (
                <TabsTrigger value="courses" className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors">
                  المقررات الدراسية
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
            {!isSubAdmin && (
              <TabsContent value="courses" className="mt-0 focus-visible:outline-none">
                <CoursesManagementTab />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
