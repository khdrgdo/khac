import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { ensureAdminOrTeacherRole } from "@/lib/roleGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ArrowRight, BookOpen, UserCheck, Pencil, Trash2, FileText, ExternalLink, HelpCircle, Megaphone, Calendar } from "lucide-react";
import { majorLabel } from "@/lib/college";
import { DeleteCourseDialog } from "@/components/courses/DeleteCourseDialog";
import { EditCourseDialog } from "@/components/courses/EditCourseDialog";
import { FilesTab } from "@/components/courses/FilesTab";
import { LinksTab } from "@/components/courses/LinksTab";
import { DiscussionsTab } from "@/components/courses/DiscussionsTab";
import { UpdatesTab } from "@/components/courses/UpdatesTab";
import { ScheduleTab } from "@/components/courses/ScheduleTab";
import { toast } from "sonner";
import type { CourseData, ScheduleEntry } from "@/components/courses/course-types";

export const Route = createFileRoute("/_authenticated/courses/$id")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: search.tab as string | undefined,
    };
  },
  component: CourseDetailPage,
});

function CourseDetailPage() {
  const { id } = useParams({ from: "/_authenticated/courses/$id" });
  const { tab } = Route.useSearch();
  const { user, isTeacher, isAdmin, isMainAdmin, isSubAdmin, profile } = useAuth();
  const permissions = getSubAdminPermissions(profile);
  const canModifyCourse = isMainAdmin || (isSubAdmin && permissions.can_courses) || isTeacher;
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Real-time synchronization inside course detail
  useEffect(() => {
    const channel = supabase
      .channel(`course-detail-${id}_${Math.random().toString(36).substring(7)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "course_links" }, () => {
        qc.invalidateQueries({ queryKey: ["course_links", id] });
        qc.invalidateQueries({ queryKey: ["course_files", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "course_updates" }, () => {
        qc.invalidateQueries({ queryKey: ["course_updates", id] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  const deleteCourse = useMutation({
    mutationFn: async () => {
      if (!canModifyCourse) throw new Error("Unauthorized");
      if (user?.id) await ensureAdminOrTeacherRole(user.id);
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success("تم حذف المقرر بنجاح");
      navigate({ to: "/courses" });
    },
    onError: (e: Error) => toast.error(e.message || "فشل في حذف المقرر"),
  });

  const [activeTab, setActiveTab] = useState<string>(tab || "files");

  useEffect(() => {
    if (tab) {
      setActiveTab(tab);
    }
  }, [tab]);

  const { data: course, isLoading: isCourseLoading } = useQuery({
    queryKey: ["course", id],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
      if (!data) return null;

      let teacherName = null;
      if (data.teacher_id) {
        const { data: profiles } = await supabase.rpc("get_public_profiles", {
          _ids: [data.teacher_id],
        });
        if (profiles && profiles.length > 0) {
          teacherName = profiles[0].full_name;
        }
      }

      return {
        ...data,
        teacher_name: teacherName,
      };
    },
  });

  const canEdit = canModifyCourse;
  const canDeleteCourse =
    !!user && (isMainAdmin || (isSubAdmin && permissions.can_courses) || user.id === course?.created_by || user.id === course?.teacher_id);

  if (isCourseLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">جارِ تحميل بيانات المقرر...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center max-w-md mx-auto">
        <BookOpen className="w-12 h-12 text-muted-foreground/60" />
        <div className="space-y-1">
          <h3 className="font-bold text-lg">المقرر الدراسي غير موجود</h3>
          <p className="text-sm text-muted-foreground">
            قد يكون تم حذف المقرر أو أن الرابط المطلوب غير صحيح.
          </p>
        </div>
        <Button asChild className="rounded-xl mt-2">
          <Link to="/courses">العودة إلى قائمة المقررات</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-10">
      <Link
        to="/courses"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition"
      >
        <ArrowRight className="w-4 h-4" /> العودة إلى قائمة المقررات
      </Link>

      {/* Main Course Header Card */}
      <Card className="border-muted/80 shadow-xs">
        <CardContent className="p-5 sm:p-6 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{course.name}</h1>
              <div className="flex gap-2 flex-wrap items-center">
                <Badge variant="secondary" className="font-semibold">
                  {majorLabel(course.major)}
                </Badge>
                <Badge variant="outline">
                  السنة {course.year} • الفصل {course.semester}
                </Badge>
                {course.teacher_name ? (
                  <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/20">
                    <UserCheck className="w-3.5 h-3.5 ml-1" /> الأستاذ: {course.teacher_name}
                  </Badge>
                ) : (
                  <Badge variant="destructive">⚠️ لم يتم تعيين أستاذ بعد</Badge>
                )}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {canModifyCourse && <EditCourseDialog course={course} />}
              {canDeleteCourse && (
                <DeleteCourseDialog
                  onDelete={() => deleteCourse.mutate()}
                  isPending={deleteCourse.isPending}
                />
              )}
            </div>
          </div>

          {course.description && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap border-t pt-3">
              {course.description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Course Detail Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full bg-muted/60 p-1 rounded-xl h-auto gap-1">
          <TabsTrigger
            value="files"
            className="rounded-lg py-2.5 font-semibold text-xs sm:text-sm gap-1.5"
          >
            <FileText className="w-4 h-4" /> الملفات
          </TabsTrigger>
          <TabsTrigger
            value="links"
            className="rounded-lg py-2.5 font-semibold text-xs sm:text-sm gap-1.5"
          >
            <ExternalLink className="w-4 h-4" /> المصادر
          </TabsTrigger>
          <TabsTrigger
            value="discussions"
            className="rounded-lg py-2.5 font-semibold text-xs sm:text-sm gap-1.5"
          >
            <HelpCircle className="w-4 h-4 text-primary" /> الأسئلة والنقاشات
          </TabsTrigger>
          <TabsTrigger
            value="updates"
            className="rounded-lg py-2.5 font-semibold text-xs sm:text-sm gap-1.5"
          >
            <Megaphone className="w-4 h-4" /> الإعلانات
          </TabsTrigger>
          <TabsTrigger
            value="schedule"
            className="rounded-lg py-2.5 font-semibold text-xs sm:text-sm gap-1.5"
          >
            <Calendar className="w-4 h-4" /> المواعيد
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="pt-4">
          <FilesTab courseId={id} canEdit={canModifyCourse} />
        </TabsContent>

        <TabsContent value="links" className="pt-4">
          <LinksTab courseId={id} canEdit={canModifyCourse} />
        </TabsContent>

        <TabsContent value="discussions" className="pt-4">
          <DiscussionsTab courseId={id} teacherId={course.teacher_id} />
        </TabsContent>

        <TabsContent value="updates" className="pt-4">
          <UpdatesTab courseId={id} canEdit={canModifyCourse} />
        </TabsContent>

        <TabsContent value="schedule" className="pt-4">
          <ScheduleTab
            course={{
              id: course.id,
              schedule: course.schedule as unknown as ScheduleEntry[] | null,
            }}
            canEdit={canModifyCourse}
            onSaved={() => qc.invalidateQueries({ queryKey: ["course", id] })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
