import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { majorLabel, MAJORS, YEARS, SEMESTERS } from "@/lib/college";
import { parseTitleAndNote, formatTitleAndNote, getFileTypeInfo } from "@/lib/courseUtils";
import { broadcastNotification } from "@/lib/notificationsStore";
import {
  ArrowRight,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Calendar,
  Megaphone,
  Download,
  Pencil,
  BookOpen,
  Clock,
  Video,
  Image as ImageIcon,
  MessageSquare,
  UserCheck,
  Play,
  HelpCircle,
  Send,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { signedUrl } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/courses/$id")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: search.tab as string | undefined,
    };
  },
  component: CourseDetailPage,
});

interface CourseFile {
  id: string;
  title: string;
  url: string;
  link_type: string | null;
  created_by: string;
  created_at: string;
}

interface CourseUpdate {
  id: string;
  course_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

function CourseDetailPage() {
  const { id } = useParams({ from: "/_authenticated/courses/$id" });
  const { tab } = Route.useSearch();
  const { user, isTeacher, isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Real-time synchronization inside course detail
  useEffect(() => {
    const channel = supabase
      .channel(`course-detail-${id}`)
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

  const canEdit = !!user;
  const canModifyCourse =
    !!user && (isAdmin || user.id === course?.created_by || user.id === course?.teacher_id);
  const canDeleteCourse =
    !!user && (isAdmin || user.id === course?.created_by || user.id === course?.teacher_id);

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

export function DeleteCourseDialog({
  onDelete,
  isPending,
}: {
  onDelete: () => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive rounded-xl gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          حذف المقرر
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" /> تأكيد حذف المقرر الدراسي
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground pt-2 leading-relaxed">
          هل أنت متأكد من رغبتك في حذف هذا المقرر الدراسي نهائياً؟ ستُحذف جميع الملفات والروابط
          والإعلانات التابعة له بشكل لا يمكن التراجع عنه.
        </p>
        <DialogFooter className="pt-4 gap-2 flex flex-col-reverse sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
            disabled={isPending}
            className="rounded-xl font-semibold"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin ml-1.5" />} نعم، حذف المقرر
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface CourseData {
  id: string;
  name: string;
  description: string | null;
  major: string;
  year: number;
  semester: number;
  teacher_id?: string | null;
}

export function EditCourseDialog({ course }: { course: CourseData }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(course.name);
  const [desc, setDesc] = useState(course.description ?? "");
  const [major, setMajor] = useState(course.major);
  const [year, setYear] = useState(String(course.year));
  const [semester, setSemester] = useState(String(course.semester));
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(course.teacher_id || "none");

  const qc = useQueryClient();

  const { data: teachers } = useQuery({
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
      setName(course.name);
      setDesc(course.description ?? "");
      setMajor(course.major);
      setYear(String(course.year));
      setSemester(String(course.semester));
      setSelectedTeacherId(course.teacher_id || "none");
    }
  }, [open, course]);

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("courses")
        .update({
          name,
          description: desc || null,
          major: major as "it" | "is" | "se",
          year: Number(year),
          semester: Number(semester),
          teacher_id: selectedTeacherId === "none" ? null : selectedTeacherId,
        })
        .eq("id", course.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث بيانات المقرر والتخصيص بنجاح");
      qc.invalidateQueries({ queryKey: ["course", course.id] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
          <Pencil className="w-3.5 h-3.5" /> تعديل البيانات
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            تعديل بيانات المقرر والأستاذ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="font-semibold text-xs text-foreground/80">اسم المقرر الدراسي</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-xs text-foreground/80">الأستاذ المشرف</Label>
            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر الأستاذ المسند له" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون أستاذ (غير معين)</SelectItem>
                {teachers?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.full_name} ({t.role === "admin" ? "مسؤول" : "أستاذ"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-xs text-foreground/80">الوصف أو المفردات</Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              className="resize-none rounded-xl"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="font-semibold text-xs text-foreground/80">التخصص</Label>
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
              <Label className="font-semibold text-xs text-foreground/80">السنة</Label>
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
              <Label className="font-semibold text-xs text-foreground/80">الفصل</Label>
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
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin ml-1.5" />} حفظ التغييرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Links Component with Notes / Comments Support */
export function LinksTab({ courseId, canEdit }: { courseId: string; canEdit: boolean }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: links, isLoading } = useQuery({
    queryKey: ["course_links", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_links")
        .select("*")
        .eq("course_id", courseId)
        .is("link_type", null)
        .order("created_at", { ascending: false });
      return (data ?? []) as CourseFile[];
    },
  });

  const del = useMutation({
    mutationFn: async (linkId: string) => {
      await supabase.from("course_links").delete().eq("id", linkId);
    },
    onSuccess: () => {
      toast.success("تم حذف الرابط بنجاح");
      qc.invalidateQueries({ queryKey: ["course_links", courseId] });
    },
  });

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-between items-center bg-muted/30 p-3 rounded-xl border">
          <span className="text-xs font-semibold text-muted-foreground">
            إضافة رابط المحاضرة، اجتماع، أو مصدر خارجي للمحاضرة
          </span>
          <AddLinkDialog courseId={courseId} />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !links || links.length === 0 ? (
        <div className="text-center py-8 border rounded-2xl border-dashed bg-muted/5">
          <ExternalLink className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">لا توجد روابط مضافة لهذا المقرر بعد</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {links.map((l) => {
            const parsed = parseTitleAndNote(l.title);

            return (
              <Card key={l.id} className="hover:border-primary/40 transition">
                <CardContent className="p-3.5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                      <ExternalLink className="w-4 h-4" />
                    </div>

                    <div className="space-y-1 flex-1 min-w-0">
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-sm hover:underline hover:text-primary block truncate text-foreground"
                      >
                        {parsed.title}
                      </a>

                      {parsed.note && (
                        <div className="bg-muted/40 border rounded-lg p-2 text-xs text-foreground/90 flex items-start gap-1.5 my-1">
                          <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <p className="leading-relaxed">
                            <strong className="text-primary font-semibold">ملاحظة الأستاذ:</strong>{" "}
                            {parsed.note}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="truncate max-w-[200px] sm:max-w-xs" dir="ltr">
                          {l.url}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />{" "}
                          {formatDistanceToNow(new Date(l.created_at), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg h-8 gap-1 text-xs"
                      asChild
                    >
                      <a href={l.url} target="_blank" rel="noreferrer">
                        فتح الرابط <ExternalLink className="w-3 h-3" />
                      </a>
                    </Button>

                    {(isAdmin || l.created_by === user?.id) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => del.mutate(l.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddLinkDialog({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  const { user } = useAuth();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const formattedTitle = formatTitleAndNote(title, note);
      const { error } = await supabase.from("course_links").insert({
        course_id: courseId,
        title: formattedTitle,
        url,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة الرابط بنجاح");
      qc.invalidateQueries({ queryKey: ["course_links", courseId] });
      setOpen(false);
      setTitle("");
      setUrl("");
      setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-xl gap-1">
          <Plus className="w-4 h-4" /> إضافة رابط
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>إضافة رابط أو مصدر خارجي</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">عنوان الرابط / اسم المصدر *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: رابط المحاضرة المباشرة على زوم، كتاب المقرر..."
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">عنوان URL *</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              dir="ltr"
              placeholder="https://..."
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">ملاحظة أو تعليق للطلاب (اختياري)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: رابط المحاضرة المسجلة ليوم الأحد الماضي، يرجى المشاهدة قبل الاختبار..."
              rows={2}
              className="resize-none rounded-xl"
            />
          </div>
        </div>
        <DialogFooter className="pt-3">
          <Button
            onClick={() => mut.mutate()}
            disabled={!title.trim() || !url.trim() || mut.isPending}
            className="rounded-xl font-semibold"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin ml-1.5" />} حفظ الرابط
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Files Component with Video/PDF Support and Teacher Notes */
export function FilesTab({ courseId, canEdit }: { courseId: string; canEdit: boolean }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [selectedFileNote, setSelectedFileNote] = useState("");
  const [customFileName, setCustomFileName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);

  const { data: files, isLoading } = useQuery({
    queryKey: ["course_files", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_links")
        .select("*")
        .eq("course_id", courseId)
        .eq("link_type", "file")
        .order("created_at", { ascending: false });
      return (data ?? []) as CourseFile[];
    },
  });

  async function handleFileUpload() {
    const fileList = fileRef.current?.files;
    if (!fileList || fileList.length === 0 || !user) return;

    setUploading(true);
    try {
      for (const f of Array.from(fileList)) {
        const isVideo = ["mp4", "mov", "webm", "mkv", "avi"].includes(
          f.name.split(".").pop()?.toLowerCase() || "",
        );

        const maxLimit = isVideo ? 100 * 1024 * 1024 : 25 * 1024 * 1024;
        if (f.size > maxLimit) {
          toast.error(`${f.name}: حجم الملف يتجاوز الحد المسموح (${isVideo ? "100MB" : "25MB"})`);
          continue;
        }

        const path = `${courseId}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("course-files").upload(path, f);
        if (upErr) {
          toast.error(upErr.message);
          continue;
        }

        const baseTitle = customFileName.trim() || f.name;
        const formattedTitle = formatTitleAndNote(baseTitle, selectedFileNote);

        await supabase.from("course_links").insert({
          course_id: courseId,
          title: formattedTitle,
          url: path,
          link_type: "file",
          created_by: user.id,
        });

        if (user) {
          broadcastNotification({
            actorId: user.id,
            actorName: user.user_metadata?.full_name || "الأستاذ",
            type: "material_added",
            title: "تحديث جديد في المقرر 📄",
            body: `تم إضافة ملحق/ملخص جديد (${baseTitle}) في المقرر الدراسي.`,
            link: `/courses/${courseId}`,
            currentUserId: user.id,
          });
        }
      }

      qc.invalidateQueries({ queryKey: ["course_files", courseId] });
      toast.success("تم رفع الملف بنجاح مع التعليق");
      setDialogOpen(false);
      setCustomFileName("");
      setSelectedFileNote("");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function downloadOrPreview(f: CourseFile) {
    const url = await signedUrl("course-files", f.url, 600);
    if (!url) {
      toast.error("تعذّر توليد رابط التنزيل");
      return;
    }

    const fileInfo = getFileTypeInfo(f.url, f.link_type);
    if (fileInfo.isVideo) {
      setSelectedVideoUrl(url);
    } else {
      window.open(url, "_blank");
    }
  }

  const del = useMutation({
    mutationFn: async (f: CourseFile) => {
      await supabase.storage.from("course-files").remove([f.url]);
      await supabase.from("course_links").delete().eq("id", f.id);
    },
    onSuccess: () => {
      toast.success("تم حذف الملف بنجاح");
      qc.invalidateQueries({ queryKey: ["course_files", courseId] });
    },
  });

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-between items-center bg-muted/30 p-3 rounded-xl border">
          <span className="text-xs font-semibold text-muted-foreground">
            رفع ملفات PDF، مذكرات، عروض تقديمة، وفيديوهات قصيرة للمقرر
          </span>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-xl gap-1">
                <Upload className="w-4 h-4" /> رفع ملف للمقرر
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>رفع ملف أو فيديو دراسي</DialogTitle>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">عنوان الملف / التسمية *</Label>
                  <Input
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="مثال: ملخص الفصل الأول PDF، شرح فيديو للمسألة..."
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    اختر الملف (PDF, Word, PPT, Video) *
                  </Label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.zip,.png,.jpg,.jpeg,.webp,.mp4,.mov,.webm,.mkv"
                    className="block w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer border rounded-xl p-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    يدعم جميع المستندات حتى 25MB، والفيديوهات حتى 100MB.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">ملاحظة أو تعليق للطلاب (اختياري)</Label>
                  <Textarea
                    value={selectedFileNote}
                    onChange={(e) => setSelectedFileNote(e.target.value)}
                    placeholder="اكتب أية ملاحظات هامّة يجب على الطلاب قراءتها عند تنزيل هذا الملف..."
                    rows={2}
                    className="resize-none rounded-xl"
                  />
                </div>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  onClick={handleFileUpload}
                  disabled={uploading}
                  className="rounded-xl font-semibold w-full"
                >
                  {uploading && <Loader2 className="w-4 h-4 animate-spin ml-1.5" />} رفع الملف الآن
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !files || files.length === 0 ? (
        <div className="text-center py-8 border rounded-2xl border-dashed bg-muted/5">
          <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">لا توجد ملفات مرفوعة لهذا المقرر بعد</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {files.map((f) => {
            const parsed = parseTitleAndNote(f.title);
            const fileInfo = getFileTypeInfo(f.url, f.link_type);

            return (
              <Card key={f.id} className="hover:border-primary/40 transition">
                <CardContent className="p-3.5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        fileInfo.type === "video"
                          ? "bg-purple-500/10 text-purple-600"
                          : fileInfo.type === "pdf"
                            ? "bg-red-500/10 text-red-600"
                            : fileInfo.type === "ppt"
                              ? "bg-orange-500/10 text-orange-600"
                              : "bg-emerald-500/10 text-emerald-600"
                      }`}
                    >
                      {fileInfo.type === "video" ? (
                        <Video className="w-4 h-4" />
                      ) : fileInfo.type === "pdf" ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                    </div>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-foreground truncate">
                          {parsed.title}
                        </h4>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {fileInfo.label}
                        </Badge>
                      </div>

                      {parsed.note && (
                        <div className="bg-muted/40 border rounded-lg p-2 text-xs text-foreground/90 flex items-start gap-1.5 my-1">
                          <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <p className="leading-relaxed">
                            <strong className="text-primary font-semibold">ملاحظة الأستاذ:</strong>{" "}
                            {parsed.note}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> تم الرفع:{" "}
                          {formatDistanceToNow(new Date(f.created_at), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg h-8 gap-1 text-xs"
                      onClick={() => downloadOrPreview(f)}
                    >
                      {fileInfo.isVideo ? (
                        <>
                          تشغيل الفيديو{" "}
                          <Play className="w-3.5 h-3.5 text-purple-600 fill-purple-600" />
                        </>
                      ) : (
                        <>
                          تحميل/تنزيل <Download className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>

                    {(isAdmin || f.created_by === user?.id) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => del.mutate(f)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Video Modal Player */}
      {selectedVideoUrl && (
        <Dialog open={!!selectedVideoUrl} onOpenChange={() => setSelectedVideoUrl(null)}>
          <DialogContent className="sm:max-w-[700px] p-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-600" /> مشغل الفيديو الشارح
              </DialogTitle>
            </DialogHeader>
            <div className="aspect-video w-full bg-black rounded-xl overflow-hidden mt-2">
              <video src={selectedVideoUrl} controls autoPlay className="w-full h-full" />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* Course Schedule Component */
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
export interface ScheduleEntry {
  day: string;
  start: string;
  end: string;
  room: string;
}

export function ScheduleTab({
  course,
  canEdit,
  onSaved,
}: {
  course: { id: string; schedule: ScheduleEntry[] | null };
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [entries, setEntries] = useState<ScheduleEntry[]>(course.schedule ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (course.schedule) {
      setEntries(course.schedule);
    }
  }, [course.schedule]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("courses")
      .update({ schedule: entries as unknown as never })
      .eq("id", course.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حفظ جدول المحاضرات بنجاح");
    onSaved();
  }

  const existing = course.schedule ?? [];

  if (!canEdit) {
    return existing.length === 0 ? (
      <div className="text-center py-8 border rounded-2xl border-dashed bg-muted/5">
        <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">لم يتم إضافة مواعيد أسبوعية لهذا المقرر بعد</p>
      </div>
    ) : (
      <div className="grid gap-2">
        {existing.map((e, i) => (
          <Card key={i} className="border-muted/60">
            <CardContent className="p-3.5 flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-bold">
                  {e.day}
                </Badge>
                <span className="font-mono text-xs dir-ltr">
                  {e.start} - {e.end}
                </span>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-lg">
                القاعة / المعمل: <strong>{e.room || "غير محدد"}</strong>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <Card key={i} className="border-muted/60">
          <CardContent className="p-3 flex flex-wrap gap-2 items-center">
            <select
              value={e.day}
              onChange={(ev) =>
                setEntries((prev) =>
                  prev.map((x, j) => (j === i ? { ...x, day: ev.target.value } : x)),
                )
              }
              className="border rounded-xl px-2.5 py-1.5 text-xs bg-background font-semibold"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <Input
              type="time"
              value={e.start}
              onChange={(ev) =>
                setEntries((p) => p.map((x, j) => (j === i ? { ...x, start: ev.target.value } : x)))
              }
              className="w-28 rounded-xl text-xs"
            />

            <Input
              type="time"
              value={e.end}
              onChange={(ev) =>
                setEntries((p) => p.map((x, j) => (j === i ? { ...x, end: ev.target.value } : x)))
              }
              className="w-28 rounded-xl text-xs"
            />

            <Input
              placeholder="اسم القاعة أو رقم القاعة"
              value={e.room}
              onChange={(ev) =>
                setEntries((p) => p.map((x, j) => (j === i ? { ...x, room: ev.target.value } : x)))
              }
              className="flex-1 min-w-32 rounded-xl text-xs"
            />

            <Button
              size="icon"
              variant="ghost"
              className="text-destructive h-8 w-8"
              onClick={() => setEntries((p) => p.filter((_, j) => j !== i))}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-2 justify-between">
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl gap-1 text-xs"
          onClick={() =>
            setEntries([...entries, { day: DAYS[0], start: "08:00", end: "09:30", room: "" }])
          }
        >
          <Plus className="w-4 h-4" /> إضافة موعد آخر
        </Button>

        <Button
          size="sm"
          onClick={save}
          disabled={saving}
          className="rounded-xl font-semibold text-xs"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin ml-1" />} حفظ الجدول للمقرر
        </Button>
      </div>
    </div>
  );
}

/* Course Announcements / Updates */
export function UpdatesTab({ courseId, canEdit }: { courseId: string; canEdit: boolean }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");

  const { data: updates, isLoading } = useQuery({
    queryKey: ["course_updates", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_updates")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });

      const rows = (data ?? []) as CourseUpdate[];
      const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
      if (!authorIds.length) return rows.map((r) => ({ ...r, author_name: "الأستاذ" }));

      const { data: authors } = await supabase.rpc("get_public_profiles", { _ids: authorIds });
      const m = new Map(
        (authors ?? []).map((a: { id: string; full_name: string }) => [a.id, a.full_name]),
      );
      return rows.map((r) => ({ ...r, author_name: m.get(r.author_id) ?? "الأستاذ" }));
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      if (!user || !content.trim()) throw new Error("يرجى كتابة نص الإعلان");
      const { error } = await supabase
        .from("course_updates")
        .insert({ course_id: courseId, author_id: user.id, content: content.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      toast.success("تم نشر الإعلان للطلاب بنجاح");
      qc.invalidateQueries({ queryKey: ["course_updates", courseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (uid: string) => {
      await supabase.from("course_updates").delete().eq("id", uid);
    },
    onSuccess: () => {
      toast.success("تم حذف الإعلان");
      qc.invalidateQueries({ queryKey: ["course_updates", courseId] });
    },
  });

  return (
    <div className="space-y-3">
      {canEdit && (
        <Card className="border-primary/30 bg-card">
          <CardContent className="p-4 space-y-3">
            <Label className="text-xs font-semibold text-foreground">
              نشر إعلان جديد للطلاب في هذا المقرر
            </Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="اكتب إعلاناً مهماً أو تنبيهاً لطلاب المقررات (مثال: تأجيل محاضرة، موعد تسليم التكليف...)"
              className="resize-none rounded-xl text-xs"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => post.mutate()}
                disabled={!content.trim() || post.isPending}
                className="rounded-xl font-semibold text-xs gap-1.5"
              >
                {post.isPending && <Loader2 className="w-4 h-4 animate-spin" />} نشر الإعلان الآن
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !updates || updates.length === 0 ? (
        <div className="text-center py-8 border rounded-2xl border-dashed bg-muted/5">
          <Megaphone className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">لا توجد إعلانات منشورة لهذا المقرر بعد</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {updates.map((u) => (
            <Card key={u.id} className="border-muted/60">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <strong className="text-foreground font-semibold">{u.author_name}</strong>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />{" "}
                      {formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: ar })}
                    </span>
                  </div>

                  {(isAdmin || u.author_id === user?.id) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => del.mutate(u.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                <p className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                  {u.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface CoursePublicProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  verified?: boolean;
}

interface CourseQuestionPost {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: CoursePublicProfile | null;
  cleanContent: string;
}

/* Course Questions & Discussions Tab */
export function DiscussionsTab({
  courseId,
  teacherId,
}: {
  courseId: string;
  teacherId?: string | null;
}) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [questionContent, setQuestionContent] = useState("");

  const coursePrefix = `[course:${courseId}]`;

  // Fetch course questions (posts)
  const { data: questions, isLoading } = useQuery({
    queryKey: ["course_questions", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .ilike("content", `${coursePrefix}%`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const postsData = data ?? [];
      const authorIds = Array.from(new Set(postsData.map((p) => p.author_id)));
      if (!authorIds.length) return [];

      const { data: profiles } = await supabase.rpc("get_public_profiles", { _ids: authorIds });
      const profileMap = new Map((profiles ?? []).map((p: CoursePublicProfile) => [p.id, p]));

      return postsData.map((p) => ({
        ...p,
        author: profileMap.get(p.author_id) ?? null,
        cleanContent: p.content.replace(coursePrefix, "").trim(),
      }));
    },
  });

  // Post question mutation
  const postQuestion = useMutation({
    mutationFn: async () => {
      if (!user || !questionContent.trim()) throw new Error("يرجى كتابة نص السؤال");
      const fullText = `${coursePrefix} ${questionContent.trim()}`;
      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: fullText,
        post_type: "question",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setQuestionContent("");
      toast.success("تم نشر سؤالك في المقرر بنجاح");
      qc.invalidateQueries({ queryKey: ["course_questions", courseId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Delete question
  const deleteQuestion = useMutation({
    mutationFn: async (qid: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", qid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف السؤال");
      qc.invalidateQueries({ queryKey: ["course_questions", courseId] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Ask Question Card */}
      <Card className="border-primary/30 bg-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <HelpCircle className="w-5 h-5 text-primary" />
            <span>طرح سؤال أو استفسار حول المقرر</span>
          </div>
          <Textarea
            value={questionContent}
            onChange={(e) => setQuestionContent(e.target.value)}
            rows={3}
            placeholder="اكتب سؤالك هنا ليستطيع الطلاب وأستاذ المقرر الإجابة عليه..."
            className="resize-none rounded-xl text-xs"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => postQuestion.mutate()}
              disabled={!questionContent.trim() || postQuestion.isPending}
              className="rounded-xl font-semibold text-xs gap-1.5"
            >
              {postQuestion.isPending && <Loader2 className="w-4 h-4 animate-spin" />} إرسال السؤال
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Questions List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !questions || questions.length === 0 ? (
        <div className="text-center py-10 border rounded-2xl border-dashed bg-muted/5">
          <HelpCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">
            لا توجد أسئلة أو نقاشات في هذا المقرر بعد
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            كن أول من يطرح سؤالاً لمناقشته مع الزملاء والمدرس!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => {
            const isTeacher = q.author_id === teacherId;
            const canDel = isAdmin || q.author_id === user?.id;

            return (
              <QuestionCard
                key={q.id}
                q={q}
                isTeacher={isTeacher}
                canDelete={canDel}
                onDelete={() => deleteQuestion.mutate(q.id)}
                teacherId={teacherId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  q,
  isTeacher,
  canDelete,
  onDelete,
  teacherId,
}: {
  q: CourseQuestionPost;
  isTeacher: boolean;
  canDelete: boolean;
  onDelete: () => void;
  teacherId?: string | null;
}) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [replyText, setReplyText] = useState("");
  const [showReplies, setShowReplies] = useState(true);

  // Fetch comments for this question
  const { data: comments, isLoading: loadingComments } = useQuery({
    queryKey: ["course_question_comments", q.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", q.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const cList = data ?? [];
      const authorIds = Array.from(new Set(cList.map((c) => c.author_id)));
      if (!authorIds.length) return [];

      const { data: profiles } = await supabase.rpc("get_public_profiles", { _ids: authorIds });
      const pMap = new Map((profiles ?? []).map((p: CoursePublicProfile) => [p.id, p]));

      return cList.map((c) => ({
        ...c,
        author: pMap.get(c.author_id) ?? null,
      }));
    },
  });

  // Add comment
  const addComment = useMutation({
    mutationFn: async () => {
      if (!user || !replyText.trim()) throw new Error("يرجى كتابة الرد");
      const { error } = await supabase.from("comments").insert({
        post_id: q.id,
        author_id: user.id,
        content: replyText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReplyText("");
      toast.success("تم إضافة إجابتك/ردك");
      qc.invalidateQueries({ queryKey: ["course_question_comments", q.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete comment
  const deleteComment = useMutation({
    mutationFn: async (cid: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", cid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الرد");
      qc.invalidateQueries({ queryKey: ["course_question_comments", q.id] });
    },
  });

  const authorName = q.author?.full_name ?? "مستخدم";

  return (
    <Card className="border-muted/80 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserAvatar
              avatarUrl={q.author?.avatar_url}
              fullName={authorName}
              className="w-9 h-9"
            />
            <div className="min-w-0">
              <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                <span>{authorName}</span>
                {q.author?.verified && <VerifiedBadge />}
                {isTeacher && (
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary text-[10px] px-1.5 py-0 font-medium"
                  >
                    أستاذ المقرر
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(q.created_at), { addSuffix: true, locale: ar })}
              </p>
            </div>
          </div>

          {canDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        <p className="text-sm font-medium text-foreground whitespace-pre-wrap leading-relaxed">
          {q.cleanContent}
        </p>

        {/* Action / Comments Header */}
        <div className="flex items-center justify-between border-t pt-2 mt-2 text-xs text-muted-foreground">
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center gap-1 hover:text-primary font-medium"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>الإجابات والردود ({comments?.length ?? 0})</span>
          </button>
        </div>

        {/* Replies / Comments */}
        {showReplies && (
          <div className="space-y-3 pt-2">
            {loadingComments ? (
              <div className="flex justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : comments && comments.length > 0 ? (
              <div className="space-y-2 border-r-2 border-primary/20 pr-3 mr-1">
                {comments.map((c) => {
                  const cName = c.author?.full_name ?? "مستخدم";
                  const isCommentTeacher = c.author_id === teacherId;
                  const canDelComment = isAdmin || c.author_id === user?.id;

                  return (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-xl bg-muted/30 border border-muted/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            avatarUrl={c.author?.avatar_url}
                            fullName={cName}
                            className="w-6 h-6"
                          />
                          <span className="font-semibold text-xs text-foreground">{cName}</span>
                          {isCommentTeacher && (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] px-1.5 py-0"
                            >
                              أستاذ المقرر
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            •{" "}
                            {formatDistanceToNow(new Date(c.created_at), {
                              addSuffix: true,
                              locale: ar,
                            })}
                          </span>
                        </div>

                        {canDelComment && (
                          <button
                            onClick={() => deleteComment.mutate(c.id)}
                            className="text-muted-foreground hover:text-destructive text-xs"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-foreground/90 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Add Answer Input */}
            <div className="flex gap-2 items-center pt-1">
              <Input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="اكتب إجابة أو تعليقاً على هذا السؤال..."
                className="h-9 text-xs rounded-xl flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (replyText.trim()) addComment.mutate();
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => addComment.mutate()}
                disabled={!replyText.trim() || addComment.isPending}
                className="h-9 px-3 rounded-xl gap-1 text-xs font-semibold"
              >
                {addComment.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>إجابة</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
