import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MAJORS, YEARS, SEMESTERS, majorLabel } from "@/lib/college";
import { parseTitleAndNote, getFileTypeInfo } from "@/lib/courseUtils";
import { broadcastNotification } from "@/lib/notificationsStore";
import {
  BookOpen,
  Plus,
  Loader2,
  Search,
  ExternalLink,
  FileText,
  GraduationCap,
  Sparkles,
  Calendar,
  Pencil,
  Trash2,
  Download,
  UserCheck,
  ShieldCheck,
  Clock,
  Video,
  FileCode,
  Image as ImageIcon,
  MessageSquare,
  Zap,
  User,
  Settings,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { EditCourseDialog, DeleteCourseDialog } from "./courses.$id";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

function DeleteCourseAction({ courseId, courseName }: { courseId: string; courseName: string }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("courses").delete().eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success("تم حذف المقرر بنجاح");
    },
    onError: (e: Error) => toast.error(e.message || "فشل في حذف المقرر"),
  });
  return <DeleteCourseDialog onDelete={() => mut.mutate()} isPending={mut.isPending} />;
}

export const Route = createFileRoute("/_authenticated/courses/")({
  component: CoursesPage,
});

export function CoursesPage() {
  const { user, profile, isTeacher, isAdmin } = useAuth();
  const qc = useQueryClient();

  const [majorFilter, setMajorFilter] = useState<string>(profile?.major ?? "all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>(
    isTeacher || isAdmin ? "management" : "catalog",
  );

  useEffect(() => {
    if (profile?.major && majorFilter === "all") {
      setMajorFilter(profile.major);
    }
  }, [profile?.major, majorFilter]);

  // Real-time synchronization for courses and material updates
  useEffect(() => {
    const channel = supabase
      .channel(`courses-live-sync_${Math.random().toString(36).substring(7)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "course_links" }, () => {
        qc.invalidateQueries({ queryKey: ["courses"] });
        qc.invalidateQueries({ queryKey: ["latest_materials_feed"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => {
        qc.invalidateQueries({ queryKey: ["courses"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "course_updates" }, () => {
        qc.invalidateQueries({ queryKey: ["course_updates"] });
        qc.invalidateQueries({ queryKey: ["latest_materials_feed"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Fetch courses with links and teacher details
  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses", majorFilter, yearFilter],
    queryFn: async () => {
      let q = supabase
        .from("courses")
        .select("*, course_links(id, link_type, created_at)")
        .order("year")
        .order("semester");
      if (majorFilter !== "all") q = q.eq("major", majorFilter as "it" | "is" | "se");
      if (yearFilter !== "all") q = q.eq("year", Number(yearFilter));
      const { data, error } = await q;
      if (error) throw error;

      // Get teacher profiles for courses
      const teacherIds = Array.from(
        new Set((data ?? []).map((c) => c.teacher_id).filter(Boolean)),
      ) as string[];

      const teacherMap = new Map<string, string>();
      if (teacherIds.length > 0) {
        const { data: profiles } = await supabase.rpc("get_public_profiles", { _ids: teacherIds });
        if (profiles) {
          profiles.forEach((p) => teacherMap.set(p.id, p.full_name));
        }
      }

      return (data ?? []).map((c) => {
        // Calculate latest update timestamp for course
        const latestLinkTime = c.course_links?.reduce(
          (max: string | null, l: { created_at: string }) => {
            if (!max || new Date(l.created_at) > new Date(max)) return l.created_at;
            return max;
          },
          null,
        );

        const lastUpdated = latestLinkTime || c.updated_at || c.created_at;

        return {
          ...c,
          teacher_name: c.teacher_id ? teacherMap.get(c.teacher_id) || "أستاذ المادة" : null,
          last_updated_at: lastUpdated,
        };
      });
    },
  });

  // Fetch latest uploaded materials across all courses for student live feed
  const { data: latestMaterials, isLoading: isFeedLoading } = useQuery({
    queryKey: ["latest_materials_feed", majorFilter],
    queryFn: async () => {
      const q = supabase
        .from("course_links")
        .select("*, courses(id, name, major, year, semester)")
        .order("created_at", { ascending: false })
        .limit(25);

      const { data, error } = await q;
      if (error) throw error;

      // Fetch author profiles
      const authorIds = Array.from(
        new Set((data ?? []).map((l) => l.created_by).filter(Boolean)),
      ) as string[];

      const authorMap = new Map<string, string>();
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase.rpc("get_public_profiles", { _ids: authorIds });
        if (profiles) {
          profiles.forEach((p) => authorMap.set(p.id, p.full_name));
        }
      }

      return (data ?? []).map((item) => ({
        ...item,
        author_name: item.created_by ? authorMap.get(item.created_by) || "الأستاذ" : "الأستاذ",
      }));
    },
  });

  // Client-side search filtering
  const filteredCourses = courses?.filter((c) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      c.name.toLowerCase().includes(query) ||
      (c.description && c.description.toLowerCase().includes(query)) ||
      (c.teacher_name && c.teacher_name.toLowerCase().includes(query))
    );
  });

  // Assigned courses for current user (if teacher or admin)
  const myAssignedCourses = courses?.filter((c) => {
    if (isAdmin) return true;
    return c.teacher_id === user?.id || c.created_by === user?.id;
  });

  // Stats calculation
  const totalCourses = courses?.length ?? 0;
  const totalFiles =
    courses?.reduce((acc, c) => {
      const filesCount =
        c.course_links?.filter((l: { link_type: string | null }) => l.link_type === "file")
          .length ?? 0;
      return acc + filesCount;
    }, 0) ?? 0;

  const totalLinks =
    courses?.reduce((acc, c) => {
      const linksCount =
        c.course_links?.filter((l: { link_type: string | null }) => !l.link_type).length ?? 0;
      return acc + linksCount;
    }, 0) ?? 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-l from-primary/10 via-card to-card p-5 sm:p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shrink-0">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">المقررات والمواد الدراسية</h1>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              تصفح ملفات المحاضرات، المذكرات، الفيديوهات، والروابط الخاصة بالتخصص والسنة الدراسية
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="shrink-0 flex items-center gap-2">
            <NewCourseDialog
              currentMajor={majorFilter}
              currentYear={yearFilter}
              onCourseCreated={(newMajor, newYear) => {
                setMajorFilter(newMajor);
                setYearFilter(newYear);
                setSearchQuery("");
              }}
            />
          </div>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b pb-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl h-auto flex-wrap">
            <TabsTrigger
              value="catalog"
              className="rounded-lg py-2 px-4 text-sm font-semibold gap-2"
            >
              <BookOpen className="w-4 h-4" /> جميع المقررات
            </TabsTrigger>
            {(isTeacher || isAdmin) && (
              <TabsTrigger
                value="management"
                className="rounded-lg py-2 px-4 text-sm font-semibold gap-2"
              >
                <Settings className="w-4 h-4" /> إدارة المقررات (كورساتي)
                {myAssignedCourses && myAssignedCourses.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {myAssignedCourses.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="feed" className="rounded-lg py-2 px-4 text-sm font-semibold gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> أحدث المرفقات والتحديثات
            </TabsTrigger>
          </TabsList>

          {/* Quick Stats Pills */}
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground self-end sm:self-auto">
            <span className="bg-card px-2.5 py-1 rounded-lg border shadow-xs">
              📚 <strong className="text-foreground">{totalCourses}</strong> مقررات
            </span>
            <span className="bg-card px-2.5 py-1 rounded-lg border shadow-xs">
              📄 <strong className="text-foreground">{totalFiles}</strong> ملفات
            </span>
            <span className="bg-card px-2.5 py-1 rounded-lg border shadow-xs">
              🔗 <strong className="text-foreground">{totalLinks}</strong> روابط
            </span>
          </div>
        </div>

        {/* Search & Filtering Bar (Visible in Catalog and Management) */}
        {activeTab !== "feed" && (
          <Card className="mt-4 border-muted/60 shadow-xs">
            <CardContent className="p-4 flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم المقرر، الوصف، أو أستاذ المادة..."
                  className="pr-9 rounded-xl bg-background"
                />
              </div>

              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                {/* Major Filter */}
                <div className="w-full sm:w-44">
                  <Select value={majorFilter} onValueChange={setMajorFilter}>
                    <SelectTrigger className="rounded-xl bg-background">
                      <SelectValue placeholder="التخصص" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل التخصصات</SelectItem>
                      {MAJORS.map((m) => (
                        <SelectItem key={m.code} value={m.code}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Year Filter */}
                <div className="w-full sm:w-36">
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="rounded-xl bg-background">
                      <SelectValue placeholder="السنة الدراسية" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل السنوات</SelectItem>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          السنة {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 1: Catalog (For Regular Students and General Browsing) */}
        <TabsContent value="catalog" className="mt-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">جارِ تحميل المقررات الدراسية...</p>
            </div>
          ) : !filteredCourses || filteredCourses.length === 0 ? (
            <div className="text-center py-12 border rounded-2xl border-dashed bg-muted/10 p-6">
              <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="font-bold text-base">لا توجد مقررات دراسية طابقة</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
                لم نجد أي مقرر دراسي يطابق خيارات التصفية الحالية. يمكنك تغيير التخصص أو السنة لعرض
                المزيد.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCourses.map((c) => {
                const linksCount =
                  c.course_links?.filter((l: { link_type: string | null }) => !l.link_type)
                    .length ?? 0;
                const filesCount =
                  c.course_links?.filter(
                    (l: { link_type: string | null }) => l.link_type === "file",
                  ).length ?? 0;

                const isMyMajor = profile?.major === c.major && profile?.year === c.year;

                return (
                  <Card
                    key={c.id}
                    className={`hover:border-primary/50 hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden border ${
                      isMyMajor ? "ring-1 ring-primary/20 bg-primary/[0.01]" : ""
                    }`}
                  >
                    <div className="p-5 flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {isMyMajor && (
                            <Badge className="bg-primary/15 text-primary border-primary/20 hover:bg-primary/20 text-[11px]">
                              مقررك الحالي
                            </Badge>
                          )}
                          <Badge variant="outline" className="rounded-full text-[11px]">
                            السنة {c.year} • ف{c.semester}
                          </Badge>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold text-base hover:text-primary transition line-clamp-1">
                          <Link to="/courses/$id" params={{ id: c.id }} search={{ tab: undefined }}>
                            {c.name}
                          </Link>
                        </h3>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <Badge variant="secondary" className="font-normal text-[11px] px-2 py-0">
                            {majorLabel(c.major)}
                          </Badge>
                          {c.teacher_name && (
                            <span className="flex items-center gap-1 text-primary/80 font-medium">
                              <UserCheck className="w-3 h-3" /> {c.teacher_name}
                            </span>
                          )}
                        </div>
                      </div>

                      {c.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {c.description}
                        </p>
                      )}
                    </div>

                    {/* Footer Info */}
                    <div className="bg-muted/20 border-t p-3 px-4 flex items-center justify-between text-xs text-muted-foreground gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-emerald-500" /> {filesCount} ملفات
                        </span>
                        <span className="flex items-center gap-1">
                          <ExternalLink className="w-3.5 h-3.5 text-amber-500" /> {linksCount} روابط
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1 h-8 text-xs"
                        asChild
                      >
                        <Link to="/courses/$id" params={{ id: c.id }} search={{ tab: "files" }}>
                          دخول المقرر <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Course Management (Core Requirement for Admins & Teachers) */}
        {(isTeacher || isAdmin) && (
          <TabsContent value="management" className="mt-4 space-y-4">
            <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
              <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-lg flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    {isAdmin ? "لوحة إدارة المقررات الكلية" : "المقررات المسندة لي كأستاذ"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {isAdmin
                      ? "يمكنك إضافة مقررات جديدة، تعيين الأستاذ المسؤول عن كل مقرر، أو تعديل وحذف أية محتويات داخل المقررات."
                      : "المقررات التي تقوم ب تدريسها. يمكنك رفع المحاضرات، الروابط، الفيديوهات، الإعلانات وتحديث الجدول."}
                  </p>
                </div>

                {isAdmin && (
                  <NewCourseDialog
                    currentMajor={majorFilter}
                    currentYear={yearFilter}
                    onCourseCreated={(newMajor, newYear) => {
                      setMajorFilter(newMajor);
                      setYearFilter(newYear);
                      setSearchQuery("");
                    }}
                  />
                )}
              </CardContent>
            </Card>

            {!myAssignedCourses || myAssignedCourses.length === 0 ? (
              <div className="text-center py-12 border rounded-2xl border-dashed bg-muted/10 p-6">
                <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="font-bold text-base">لا توجد مقررات للتحكم حالياً</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {isAdmin
                    ? "قم بإضافة مقررات دراسية جديدة وتعيين الأساتذة لها."
                    : "لم يتم تعيينك كأستاذ مسؤول عن أي مقرر دراسي بعد. تواصل مع مسؤول النظام لربطك بالمواد."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {myAssignedCourses.map((c) => {
                  const linksCount =
                    c.course_links?.filter((l: { link_type: string | null }) => !l.link_type)
                      .length ?? 0;
                  const filesCount =
                    c.course_links?.filter(
                      (l: { link_type: string | null }) => l.link_type === "file",
                    ).length ?? 0;

                  return (
                    <Card key={c.id} className="border-muted/80 hover:border-primary/40 transition">
                      <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="font-semibold text-xs">
                              {majorLabel(c.major)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              السنة {c.year} • الفصل {c.semester}
                            </Badge>
                            {c.teacher_name ? (
                              <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 text-xs border-emerald-500/20">
                                👨‍🏫 الأستاذ: {c.teacher_name}
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                ⚠️ بدون أستاذ
                              </Badge>
                            )}
                          </div>

                          <h3 className="font-bold text-lg text-foreground">{c.name}</h3>
                          {c.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {c.description}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                            <span className="flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5 text-emerald-500" /> {filesCount}{" "}
                              ملفات
                            </span>
                            <span className="flex items-center gap-1">
                              <ExternalLink className="w-3.5 h-3.5 text-amber-500" /> {linksCount}{" "}
                              روابط
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground/70">
                              <Clock className="w-3.5 h-3.5" /> آخر تحديث:{" "}
                              {formatDistanceToNow(new Date(c.last_updated_at), {
                                addSuffix: true,
                                locale: ar,
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Direct Management Actions */}
                        <div className="flex flex-wrap sm:flex-col lg:flex-row items-center gap-2 shrink-0 border-t sm:border-t-0 sm:border-r pt-3 sm:pt-0 sm:pr-4">
                          <Button
                            size="sm"
                            className="rounded-xl gap-1.5 flex-1 sm:flex-initial"
                            asChild
                          >
                            <Link to="/courses/$id" params={{ id: c.id }} search={{ tab: "files" }}>
                              <Pencil className="w-3.5 h-3.5" /> إدارة المحتوى والملفات
                            </Link>
                          </Button>

                          <EditCourseDialog course={c} />

                          {isAdmin && <DeleteCourseAction courseId={c.id} courseName={c.name} />}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}

        {/* Tab 3: Latest Uploads & Feed (Real-Time Student Requirement) */}
        <TabsContent value="feed" className="mt-4 space-y-4">
          <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                تغذية فورية مباشرة لجميع الملفات والروابط والتحديثات التي أضافها الأساتذة مؤخراً.
              </span>
            </div>
            <Badge variant="outline" className="bg-background text-amber-600 border-amber-500/30">
              تحديث تلقائي مفعّل ⚡
            </Badge>
          </div>

          {isFeedLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !latestMaterials || latestMaterials.length === 0 ? (
            <div className="text-center py-12 border rounded-2xl border-dashed bg-muted/10 p-6">
              <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="font-bold text-base">لا توجد إضافات حديثة</h3>
              <p className="text-xs text-muted-foreground mt-1">
                سيظهر هنا أي ملف أو رابط أو إعلان جديد يتم رفعه من قبل الأساتذة فوراً.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {latestMaterials.map((item) => {
                const parsed = parseTitleAndNote(item.title);
                const fileInfo = getFileTypeInfo(item.url, item.link_type);

                return (
                  <Card key={item.id} className="hover:border-primary/40 transition">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                            fileInfo.type === "video"
                              ? "bg-purple-500/10 text-purple-600"
                              : fileInfo.type === "pdf"
                                ? "bg-red-500/10 text-red-600"
                                : fileInfo.type === "ppt"
                                  ? "bg-orange-500/10 text-orange-600"
                                  : fileInfo.type === "link"
                                    ? "bg-amber-500/10 text-amber-600"
                                    : "bg-emerald-500/10 text-emerald-600"
                          }`}
                        >
                          {fileInfo.type === "video" ? (
                            <Video className="w-5 h-5" />
                          ) : fileInfo.type === "pdf" || fileInfo.type === "ppt" ? (
                            <FileText className="w-5 h-5" />
                          ) : fileInfo.type === "link" ? (
                            <ExternalLink className="w-5 h-5" />
                          ) : (
                            <ImageIcon className="w-5 h-5" />
                          )}
                        </div>

                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-foreground truncate">
                              {parsed.title}
                            </h4>
                            <Badge variant="outline" className="text-[10px] px-2 py-0">
                              {fileInfo.label}
                            </Badge>
                            {item.courses && (
                              <Badge variant="secondary" className="text-[10px] px-2 py-0">
                                {item.courses.name} ({majorLabel(item.courses.major)})
                              </Badge>
                            )}
                          </div>

                          {/* Teacher Note / Comment if available */}
                          {parsed.note && (
                            <div className="bg-muted/40 border border-muted/80 rounded-lg p-2 text-xs text-foreground/90 flex items-start gap-1.5 my-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                              <p className="leading-relaxed">
                                <strong className="text-primary font-semibold">
                                  ملاحظة الأستاذ:
                                </strong>{" "}
                                {parsed.note}
                              </p>
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                            <span className="flex items-center gap-1 font-medium text-foreground/80">
                              <User className="w-3 h-3 text-primary" /> {item.author_name}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />{" "}
                              {formatDistanceToNow(new Date(item.created_at), {
                                addSuffix: true,
                                locale: ar,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action button */}
                      <div className="shrink-0 self-end sm:self-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl gap-1.5 text-xs"
                          asChild
                        >
                          <Link
                            to="/courses/$id"
                            params={{ id: item.course_id }}
                            search={{ tab: item.link_type === "file" ? "files" : "links" }}
                          >
                            عرض في المقرر <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* Dialog for Adding New Course (Admin Feature with Teacher Assignment) */
interface NewCourseDialogProps {
  currentMajor?: string;
  currentYear?: string;
  onCourseCreated?: (major: string, year: string) => void;
}

export function NewCourseDialog({
  currentMajor = "all",
  currentYear = "all",
  onCourseCreated,
}: NewCourseDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [major, setMajor] = useState(currentMajor !== "all" ? currentMajor : "it");
  const [year, setYear] = useState(currentYear !== "all" ? currentYear : "1");
  const [semester, setSemester] = useState("1");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("none");

  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();

  // Fetch list of teachers and admins for teacher assignment dropdown
  const { data: teachers, isLoading: loadingTeachers } = useQuery({
    queryKey: ["teachers_and_admins_list"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["teacher", "admin"]);

      if (!roles || roles.length === 0) return [];

      const userIds = Array.from(new Set(roles.map((r) => r.user_id)));
      const { data: profiles } = await supabase.rpc("get_public_profiles", { _ids: userIds });

      const roleMap = new Map(roles.map((r) => [r.user_id, r.role]));
      return (profiles ?? []).map((p) => ({
        ...p,
        role: roleMap.get(p.id) ?? "teacher",
      }));
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setName("");
      setDesc("");
      setMajor(currentMajor !== "all" ? currentMajor : "it");
      setYear(currentYear !== "all" ? currentYear : "1");
      setSemester("1");
      setSelectedTeacherId(user?.id || "none");
    }
  }, [open, currentMajor, currentYear, user?.id]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("courses").insert({
        name,
        description: desc || null,
        major: major as "it" | "is" | "se",
        year: Number(year),
        semester: Number(semester),
        created_by: user.id,
        teacher_id: selectedTeacherId === "none" ? null : selectedTeacherId,
      });
      if (error) throw error;

      broadcastNotification({
        actorId: user.id,
        actorName: user.user_metadata?.full_name || "إدارة الكلية",
        type: "course_added",
        title: "إضافة مادة جديدة 📚",
        body: `تم إضافة المقرر الدراسي "${name}" لطلاب قسم ${major.toUpperCase()} السنة ${year}`,
        link: "/courses",
        currentUserId: user.id,
      });
    },
    onSuccess: () => {
      toast.success("تم إنشاء المقرر وتعيين الأستاذ بنجاح");
      qc.invalidateQueries({ queryKey: ["courses"] });
      if (onCourseCreated) {
        onCourseCreated(major, year);
      }
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "فشل في إنشاء المقرر"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-sm gap-1.5 font-semibold">
          <Plus className="w-4 h-4" /> مقرر دراسي جديد
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" /> إضافة مقرر دراسي جديد
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="font-semibold text-xs text-foreground/80">اسم المقرر الدراسي *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: البرمجة الكائنية، شبكات الحاسوب..."
              className="rounded-xl"
            />
          </div>

          {/* Teacher Selection Dropdown (Core Admin Requirement) */}
          <div className="space-y-1.5">
            <Label className="font-semibold text-xs text-foreground/80 flex items-center justify-between">
              <span>الأستاذ المشرف / مبرمج المادة</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                (يتم ختياره من أساتذة الكلية)
              </span>
            </Label>

            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue
                  placeholder={
                    loadingTeachers ? "جارِ تحميل الأساتذة..." : "اختر الأستاذ المسند له"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون أستاذ (لاحقاً)</SelectItem>
                {teachers?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.full_name} ({t.role === "admin" ? "مسؤول" : "أستاذ"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-xs text-foreground/80">
              الوصف والمفردات الدراسية
            </Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="اكتب نبذة مختصرة عن أهداف المقرر أو مفرداته..."
              rows={3}
              className="resize-none rounded-xl"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="font-semibold text-xs text-foreground/80">التخصص *</Label>
              <Select value={major} onValueChange={setMajor}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAJORS.map((m) => (
                    <SelectItem key={m.code} value={m.code}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-xs text-foreground/80">السنة *</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      السنة {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-xs text-foreground/80">الفصل *</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      الفصل {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button
            onClick={() => mut.mutate()}
            disabled={!name.trim() || !major || !year || mut.isPending}
            className="w-full sm:w-auto rounded-xl font-semibold"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin ml-1.5" />} إضافة المقرر
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
