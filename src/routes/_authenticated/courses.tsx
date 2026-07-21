import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, type MouseEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
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
import { MAJORS, YEARS, SEMESTERS, majorLabel } from "@/lib/college";
import {
  BookOpen,
  Plus,
  Loader2,
  Search,
  ExternalLink,
  FileText,
  GraduationCap,
  Sparkles,
  BarChart3,
  Calendar,
  Download,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { signedUrl } from "@/lib/storage";

function QuickPdfDownload({ title, path }: { title: string; path: string }) {
  const [loading, setLoading] = useState(false);
  async function handleClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      const url = await signedUrl("course-files", path, 300);
      if (url) window.open(url, "_blank");
      else toast.error("تعذّر توليد رابط التنزيل");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-xl gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/40 dark:hover:bg-red-950/30"
      onClick={handleClick}
      disabled={loading}
      title={title}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      PDF
    </Button>
  );
}

export const Route = createFileRoute("/_authenticated/courses")({
  component: CoursesPage,
});

function CoursesPage() {
  const { user, profile, isTeacher, isAdmin } = useAuth();
  const [majorFilter, setMajorFilter] = useState<string>(profile?.major ?? "all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (profile?.major) {
      setMajorFilter(profile.major);
    }
  }, [profile?.major]);

  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses", majorFilter, yearFilter],
    queryFn: async () => {
      let q = supabase
        .from("courses")
        .select("*, course_links(id, link_type, title, url)")
        .order("year")
        .order("semester");
      if (majorFilter !== "all") q = q.eq("major", majorFilter as "it" | "is" | "se");
      if (yearFilter !== "all") q = q.eq("year", Number(yearFilter));
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Client-side search filtering
  const filteredCourses = courses?.filter((c) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      c.name.toLowerCase().includes(query) ||
      (c.description && c.description.toLowerCase().includes(query))
    );
  });

  // Calculate statistics
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
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-l from-primary/5 via-transparent to-transparent p-4 sm:p-6 rounded-2xl border border-muted/35">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">المقررات الدراسية</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              روابط المحاضرات، الملفات والجدول الدراسي لكل تخصص وسنة دراسية
            </p>
          </div>
        </div>
        {(isTeacher || isAdmin) && (
          <NewCourseDialog
            currentMajor={majorFilter}
            currentYear={yearFilter}
            onCourseCreated={(newMajor, newYear) => {
              setMajorFilter(newMajor);
              setYearFilter(newYear);
              setSearchQuery(""); // Reset search query to make sure it's visible
            }}
          />
        )}
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border bg-card rounded-xl p-3 sm:p-4 text-center sm:text-right flex flex-col sm:flex-row items-center justify-between gap-2 shadow-sm">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground">إجمالي المقررات</div>
            <div className="font-extrabold text-lg sm:text-2xl text-foreground mt-0.5">
              {totalCourses}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 hidden sm:flex">
            <BookOpen className="w-4 h-4" />
          </div>
        </div>

        <div className="border bg-card rounded-xl p-3 sm:p-4 text-center sm:text-right flex flex-col sm:flex-row items-center justify-between gap-2 shadow-sm">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground">الملفات والمذكرات</div>
            <div className="font-extrabold text-lg sm:text-2xl text-emerald-600 mt-0.5">
              {totalFiles}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 hidden sm:flex">
            <FileText className="w-4 h-4" />
          </div>
        </div>

        <div className="border bg-card rounded-xl p-3 sm:p-4 text-center sm:text-right flex flex-col sm:flex-row items-center justify-between gap-2 shadow-sm">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground">المصادر والروابط</div>
            <div className="font-extrabold text-lg sm:text-2xl text-amber-600 mt-0.5">
              {totalLinks}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 hidden sm:flex">
            <ExternalLink className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <Card className="border-muted/50 shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن مقرر باسمه أو وصفه..."
              className="pr-9 rounded-lg"
            />
          </div>

          <div className="flex gap-2.5 flex-wrap md:flex-nowrap">
            {/* Major filter */}
            <div className="flex-1 md:w-44">
              <Select value={majorFilter} onValueChange={setMajorFilter}>
                <SelectTrigger className="rounded-lg">
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

            {/* Year filter */}
            <div className="flex-1 md:w-36">
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="rounded-lg">
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

      {/* Course List Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !filteredCourses || filteredCourses.length === 0 ? (
        <div className="text-center py-12 border rounded-2xl border-dashed bg-muted/5">
          <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="font-semibold text-base">لا توجد مقررات مطابقة</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            لم نجد أي مقرر دراسي يطابق خيارات البحث الحالية. جرب تغيير عوامل التصفية أو ابدأ بإضافة
            مقرر جديد.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filteredCourses.map((c) => {
            const linksCount =
              c.course_links?.filter((l: { link_type: string | null }) => !l.link_type).length ?? 0;
            const filesCount =
              c.course_links?.filter((l: { link_type: string | null }) => l.link_type === "file")
                .length ?? 0;
            const pdfFiles =
              c.course_links?.filter(
                (l: { link_type: string | null; title: string }) =>
                  l.link_type === "file" && l.title.toLowerCase().endsWith(".pdf"),
              ) ?? [];

            const canModifyCourse =
              !!user && (isAdmin || user.id === c.created_by || user.id === c.teacher_id);
            const canDeleteCourse =
              !!user && (isAdmin || user.id === c.created_by || user.id === c.teacher_id);

            return (
              <Card
                key={c.id}
                className="hover:border-primary/40 hover:shadow-md transition-all duration-300 group h-full flex flex-col justify-between overflow-hidden border border-muted/50"
              >
                <Link
                  to="/courses/$id"
                  params={{ id: c.id }}
                  search={{ tab: undefined }}
                  className="block flex-1"
                >
                  <div className="p-5 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/5 text-primary flex items-center justify-center group-hover:bg-primary/10 transition">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <Badge variant="secondary" className="shrink-0 rounded-full font-medium">
                        السنة {c.year} • ف{c.semester}
                      </Badge>
                    </div>

                    <h3 className="font-bold text-lg mt-3 group-hover:text-primary transition line-clamp-1">
                      {c.name}
                    </h3>

                    <div className="text-xs text-primary/70 font-medium mt-1 bg-primary/5 inline-block px-2 py-0.5 rounded-full">
                      {majorLabel(c.major)}
                    </div>

                    {c.description && (
                      <p className="mt-2.5 text-sm line-clamp-2 text-muted-foreground leading-relaxed">
                        {c.description}
                      </p>
                    )}
                  </div>
                </Link>

                {/* Card bottom stats bar */}
                <div className="bg-muted/15 border-t border-muted/40 p-3 px-5 flex flex-col gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{filesCount} ملفات</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
                      <span>{linksCount} روابط</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl gap-1.5 flex-1"
                      asChild
                    >
                      <Link to="/courses/$id" params={{ id: c.id }} search={{ tab: "files" }}>
                        <FileText className="w-3.5 h-3.5" /> تصفح الملفات
                      </Link>
                    </Button>

                    {pdfFiles.length > 0 && (
                      <QuickPdfDownload title={pdfFiles[0].title} path={pdfFiles[0].url} />
                    )}

                    {(canModifyCourse || canDeleteCourse) && (
                      <Button variant="default" size="sm" className="rounded-xl gap-1.5" asChild>
                        <Link
                          to="/courses/$id/manage"
                          params={{ id: c.id }}
                          search={{ tab: undefined }}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> إدارة
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface NewCourseDialogProps {
  currentMajor?: string;
  currentYear?: string;
  onCourseCreated?: (major: string, year: string) => void;
}

function NewCourseDialog({
  currentMajor = "all",
  currentYear = "all",
  onCourseCreated,
}: NewCourseDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [major, setMajor] = useState(currentMajor !== "all" ? currentMajor : "");
  const [year, setYear] = useState(currentYear !== "all" ? currentYear : "");
  const [semester, setSemester] = useState("1");
  const { user } = useAuth();
  const qc = useQueryClient();

  // Reset or pre-fill state when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setDesc("");
      setMajor(currentMajor !== "all" ? currentMajor : "");
      setYear(currentYear !== "all" ? currentYear : "");
      setSemester("1");
    }
  }, [open, currentMajor, currentYear]);

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
        teacher_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة المقرر الدراسي بنجاح");
      qc.invalidateQueries({ queryKey: ["courses"] });
      if (onCourseCreated) {
        onCourseCreated(major, year);
      }
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-sm gap-1.5">
          <Plus className="w-4 h-4" /> مقرر دراسي جديد
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> إضافة مقرر دراسي جديد
          </DialogTitle>
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
        <DialogFooter className="pt-4 gap-2 sm:gap-0">
          <Button
            onClick={() => mut.mutate()}
            disabled={!name || !major || !year || mut.isPending}
            className="w-full sm:w-auto rounded-lg"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin ml-1.5" />} حفظ التغييرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
