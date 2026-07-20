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
  Search,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { uploadFile, signedUrl } from "@/lib/storage";
import { fileKind, linkKind, isImageFile } from "@/lib/courseMaterialKind";
import { format, formatDistanceToNow } from "date-fns";
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

  const { data: course } = useQuery({
    queryKey: ["course", id],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: teacher } = useQuery({
    queryKey: ["course-teacher", course?.teacher_id],
    enabled: !!course?.teacher_id,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_profiles", { _ids: [course!.teacher_id!] });
      return data?.[0] ?? null;
    },
  });

  const canModifyCourse =
    !!user && (isAdmin || user.id === course?.created_by || user.id === course?.teacher_id);
  const canDeleteCourse =
    !!user && (isAdmin || user.id === course?.created_by || user.id === course?.teacher_id);

  if (!course)
    return <div className="text-center py-10 text-sm text-muted-foreground">جارِ التحميل...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link
        to="/courses"
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowRight className="w-4 h-4" /> العودة إلى الكورسات
      </Link>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <h1 className="text-xl font-bold">{course.name}</h1>
              <div className="flex gap-1.5 flex-wrap items-center">
                <Badge variant="secondary">{majorLabel(course.major)}</Badge>
                <Badge variant="outline">
                  السنة {course.year} • فصل {course.semester}
                </Badge>
                {teacher && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> د. {teacher.full_name}
                  </span>
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
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
              {course.description}
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue={tab || "links"}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="links">
            <ExternalLink className="w-4 h-4" /> روابط
          </TabsTrigger>
          <TabsTrigger value="files">
            <FileText className="w-4 h-4" /> ملفات
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <Calendar className="w-4 h-4" /> الجدول
          </TabsTrigger>
          <TabsTrigger value="updates">
            <Megaphone className="w-4 h-4" /> إعلانات
          </TabsTrigger>
        </TabsList>
        <TabsContent value="links" className="pt-3">
          <LinksTab courseId={id} canEdit={canModifyCourse} />
        </TabsContent>
        <TabsContent value="files" className="pt-3">
          <FilesTab courseId={id} canEdit={canModifyCourse} />
        </TabsContent>
        <TabsContent value="schedule" className="pt-3">
          <ScheduleTab
            course={{
              id: course.id,
              schedule: course.schedule as unknown as ScheduleEntry[] | null,
            }}
            canEdit={canModifyCourse}
            onSaved={() => qc.invalidateQueries({ queryKey: ["course", id] })}
          />
        </TabsContent>
        <TabsContent value="updates" className="pt-3">
          <UpdatesTab courseId={id} canEdit={canModifyCourse} />
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
          className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 rounded-xl gap-1.5 animate-in fade-in zoom-in duration-200"
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
        <DialogFooter className="pt-4 gap-2 sm:gap-0 flex flex-col-reverse sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-lg sm:ml-2">
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
            disabled={isPending}
            className="rounded-lg mb-2 sm:mb-0"
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
}

export function EditCourseDialog({ course }: { course: CourseData }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(course.name);
  const [desc, setDesc] = useState(course.description ?? "");
  const [major, setMajor] = useState(course.major);
  const [year, setYear] = useState(String(course.year));
  const [semester, setSemester] = useState(String(course.semester));
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setName(course.name);
      setDesc(course.description ?? "");
      setMajor(course.major);
      setYear(String(course.year));
      setSemester(String(course.semester));
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
        })
        .eq("id", course.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث المقرر الدراسي بنجاح");
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
          <Pencil className="w-3.5 h-3.5" /> تعديل المقرر
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">تعديل بيانات المقرر الدراسي</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="font-semibold text-xs text-foreground/80">اسم المقرر الدراسي</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: رياضيات الحاسوب، شبكات..."
              className="rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold text-xs text-foreground/80">الوصف أو المفردات</Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="اكتب نبذة مختصرة عن هذا المقرر الدراسي..."
              rows={3}
              className="resize-none rounded-lg"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="font-semibold text-xs text-foreground/80">التخصص</Label>
              <Select value={major} onValueChange={setMajor}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="—" />
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
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="—" />
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
                <SelectTrigger className="rounded-lg">
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
        <div className="bg-primary/5 rounded-lg p-3 text-xs text-primary/80 flex items-start gap-2 mt-2">
          <BookOpen className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            لإضافة ملفات (PDF، صور) أو روابط لهذا المقرر، قم بالدخول إلى صفحة المقرر واستخدم تبويبات
            "المصادر والروابط" أو "الملفات".
          </p>
        </div>
        <DialogFooter className="pt-4 gap-2 sm:gap-0">
          <Button
            onClick={() => mut.mutate()}
            disabled={!name || !major || !year || mut.isPending}
            className="w-full sm:w-auto rounded-lg"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin ml-1.5" />} تحديث المقرر
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinksTab({ courseId, canEdit }: { courseId: string; canEdit: boolean }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data: links } = useQuery({
    queryKey: ["course_links", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_links")
        .select("*")
        .eq("course_id", courseId)
        .is("link_type", null)
        .order("created_at");
      return (data ?? []) as CourseFile[];
    },
  });
  const del = useMutation({
    mutationFn: async (linkId: string) => {
      await supabase.from("course_links").delete().eq("id", linkId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course_links", courseId] }),
  });

  const filtered = (links ?? []).filter((l) =>
    q.trim() ? l.title.toLowerCase().includes(q.trim().toLowerCase()) : true,
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بين الروابط..."
            className="pr-9"
          />
        </div>
        {canEdit && <AddLinkDialog courseId={courseId} />}
      </div>
      {!links || links.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">لا توجد روابط بعد</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">لا نتائج مطابقة</div>
      ) : (
        filtered.map((l) => {
          const kind = linkKind(l.url);
          const Icon = kind.icon;
          return (
            <Card key={l.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-3 flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${kind.bg}`}
                >
                  <Icon className={`w-4 h-4 ${kind.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:underline block truncate"
                  >
                    {l.title}
                  </a>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className={kind.color}>{kind.label}</span>
                    <span>·</span>
                    <span>
                      {formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: ar })}
                    </span>
                  </div>
                </div>
                <a href={l.url} target="_blank" rel="noreferrer">
                  <Button size="icon" variant="ghost">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </a>
                {(isAdmin || l.created_by === user?.id) && (
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(l.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function AddLinkDialog({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const { user } = useAuth();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("course_links")
        .insert({ course_id: courseId, title, url, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الإضافة");
      qc.invalidateQueries({ queryKey: ["course_links", courseId] });
      setOpen(false);
      setTitle("");
      setUrl("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4" /> رابط
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة رابط</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>الرابط</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              dir="ltr"
              placeholder="https://..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={!title || !url || mut.isPending}>
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />} حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilesTab({ courseId, canEdit }: { courseId: string; canEdit: boolean }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: files } = useQuery({
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

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || !user) return;
    setUploading(true);
    try {
      for (const f of Array.from(fileList)) {
        if (f.size > 20 * 1024 * 1024) {
          toast.error(`${f.name}: أكبر من 20MB`);
          continue;
        }
        const path = `${courseId}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("course-files").upload(path, f);
        if (upErr) {
          toast.error(upErr.message);
          continue;
        }
        await supabase.from("course_links").insert({
          course_id: courseId,
          title: f.name,
          url: path,
          link_type: "file",
          created_by: user.id,
        });
      }
      qc.invalidateQueries({ queryKey: ["course_files", courseId] });
      toast.success("تم الرفع");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function download(f: CourseFile) {
    const url = await signedUrl("course-files", f.url, 300);
    if (url) window.open(url, "_blank");
    else toast.error("تعذّر توليد الرابط");
  }

  const del = useMutation({
    mutationFn: async (f: CourseFile) => {
      await supabase.storage.from("course-files").remove([f.url]);
      await supabase.from("course_links").delete().eq("id", f.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course_files", courseId] }),
  });

  const typeChips = [
    { key: "all", label: "الكل" },
    { key: "pdf", label: "PDF" },
    { key: "ppt|pptx", label: "عروض" },
    { key: "doc|docx", label: "Word" },
    { key: "png|jpg|jpeg|webp|gif", label: "صور" },
    { key: "zip|rar|7z", label: "أرشيف" },
  ];

  const filtered = (files ?? []).filter((f) => {
    const matchesQuery = q.trim() ? f.title.toLowerCase().includes(q.trim().toLowerCase()) : true;
    if (!matchesQuery) return false;
    if (typeFilter === "all") return true;
    const ext = f.title.split(".").pop()?.toLowerCase() ?? "";
    return typeFilter.split("|").includes(ext);
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بين الملفات..."
            className="pr-9"
          />
        </div>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.ppt,.pptx,.doc,.docx,.zip,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              رفع
            </Button>
          </>
        )}
      </div>

      {files && files.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {typeChips.map((c) => (
            <button
              key={c.key}
              onClick={() => setTypeFilter(c.key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                typeFilter === c.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-muted hover:border-primary/40"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {!files || files.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          لا توجد ملفات — يمكن رفع PDF / PPT / صور
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">لا نتائج مطابقة</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filtered.map((f) => {
            const kind = fileKind(f.title);
            const Icon = kind.icon;
            const thumbCandidate = isImageFile(f.title);
            return (
              <Card key={f.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${kind.bg}`}
                  >
                    <Icon className={`w-5 h-5 ${kind.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-sm">{f.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className={kind.color}>{kind.label}</span>
                      {thumbCandidate && <span>· معاينة صورة</span>}
                      <span>·</span>
                      <span>
                        {formatDistanceToNow(new Date(f.created_at), {
                          addSuffix: true,
                          locale: ar,
                        })}
                      </span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => download(f)}>
                    <Download className="w-4 h-4" />
                  </Button>
                  {(isAdmin || f.created_by === user?.id) && (
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(f)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
interface ScheduleEntry {
  day: string;
  start: string;
  end: string;
  room: string;
}

function ScheduleTab({
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
    toast.success("تم حفظ الجدول");
    onSaved();
  }

  const existing = course.schedule ?? [];

  if (!canEdit) {
    return existing.length === 0 ? (
      <div className="text-center py-6 text-sm text-muted-foreground">لا يوجد جدول بعد</div>
    ) : (
      <div className="space-y-2">
        {existing.map((e, i) => (
          <Card key={i}>
            <CardContent className="p-3 flex justify-between text-sm">
              <div>
                <b>{e.day}</b> • {e.start} - {e.end}
              </div>
              <div className="text-muted-foreground">{e.room}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((e, i) => (
        <Card key={i}>
          <CardContent className="p-3 flex flex-wrap gap-2 items-center">
            <select
              value={e.day}
              onChange={(ev) =>
                setEntries((prev) =>
                  prev.map((x, j) => (j === i ? { ...x, day: ev.target.value } : x)),
                )
              }
              className="border rounded px-2 py-1 text-sm bg-background"
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
              className="w-28"
            />
            <Input
              type="time"
              value={e.end}
              onChange={(ev) =>
                setEntries((p) => p.map((x, j) => (j === i ? { ...x, end: ev.target.value } : x)))
              }
              className="w-28"
            />
            <Input
              placeholder="القاعة"
              value={e.room}
              onChange={(ev) =>
                setEntries((p) => p.map((x, j) => (j === i ? { ...x, room: ev.target.value } : x)))
              }
              className="flex-1 min-w-32"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEntries((p) => p.filter((_, j) => j !== i))}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </CardContent>
        </Card>
      ))}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setEntries([...entries, { day: DAYS[0], start: "08:00", end: "09:30", room: "" }])
          }
        >
          <Plus className="w-4 h-4" /> إضافة موعد
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} حفظ الجدول
        </Button>
      </div>
    </div>
  );
}

function UpdatesTab({ courseId, canEdit }: { courseId: string; canEdit: boolean }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const { data: updates } = useQuery({
    queryKey: ["course_updates", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_updates")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as CourseUpdate[];
      const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
      if (!authorIds.length) return rows.map((r) => ({ ...r, author_name: "" }));
      const { data: authors } = await supabase.rpc("get_public_profiles", { _ids: authorIds });
      const m = new Map(
        (authors ?? []).map((a: { id: string; full_name: string }) => [a.id, a.full_name]),
      );
      return rows.map((r) => ({ ...r, author_name: m.get(r.author_id) ?? "" }));
    },
  });
  const post = useMutation({
    mutationFn: async () => {
      if (!user || !content.trim()) throw new Error("أدخل محتوى");
      const { error } = await supabase
        .from("course_updates")
        .insert({ course_id: courseId, author_id: user.id, content: content.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      toast.success("تم النشر");
      qc.invalidateQueries({ queryKey: ["course_updates", courseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (uid: string) => {
      await supabase.from("course_updates").delete().eq("id", uid);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course_updates", courseId] }),
  });

  return (
    <div className="space-y-3">
      {canEdit && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="اكتب إعلانًا أو تحديثًا للطلاب..."
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => post.mutate()}
                disabled={!content.trim() || post.isPending}
              >
                {post.isPending && <Loader2 className="w-4 h-4 animate-spin" />} نشر إعلان
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {!updates || updates.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">لا توجد إعلانات</div>
      ) : (
        updates.map((u) => (
          <Card key={u.id}>
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div>
                  <b className="text-foreground">{u.author_name}</b> •{" "}
                  {formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: ar })}
                </div>
                {(isAdmin || u.author_id === user?.id) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => del.mutate(u.id)}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm">{u.content}</p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// Silence unused import for format if not used above
void format;
