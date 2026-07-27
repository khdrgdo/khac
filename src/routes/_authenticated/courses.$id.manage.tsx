import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Calendar,
  Megaphone,
  Save,
  Trash2,
  ShieldCheck,
  Eye,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  DeleteCourseDialog,
  LinksTab,
  FilesTab,
  ScheduleTab,
  UpdatesTab,
  type ScheduleEntry,
} from "./courses.$id";

export const Route = createFileRoute("/_authenticated/courses/$id/manage")({
  component: ManageCoursePage,
});

function ManageCoursePage() {
  const { id } = useParams({ from: "/_authenticated/courses/$id/manage" });
  const { user, isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", id],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const canManage =
    !!user && (isAdmin || user.id === course?.created_by || user.id === course?.teacher_id);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [major, setMajor] = useState("it");
  const [year, setYear] = useState("1");
  const [semester, setSemester] = useState("1");
  const [teacherId, setTeacherId] = useState<string>("");

  useEffect(() => {
    if (course) {
      setName(course.name);
      setDesc(course.description ?? "");
      setMajor(course.major);
      setYear(String(course.year));
      setSemester(String(course.semester));
      setTeacherId(course.teacher_id ?? "");
    }
  }, [course]);

  const { data: teachers } = useQuery({
    queryKey: ["teachers-list"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "teacher");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.rpc("get_public_profiles", { _ids: ids });
      return data ?? [];
    },
  });

  const saveInfo = useMutation({
    mutationFn: async () => {
      const payload: Database["public"]["Tables"]["courses"]["Update"] = {
        name,
        description: desc || null,
        major: major as "it" | "is" | "se",
        year: Number(year),
        semester: Number(semester),
      };
      if (isAdmin) payload.teacher_id = teacherId || null;
      const { error } = await supabase.from("courses").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ بيانات المقرر");
      qc.invalidateQueries({ queryKey: ["course", id] });
      qc.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر الحفظ"),
  });

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

  if (isLoading || loading || !course) {
    return <div className="text-center py-10 text-sm text-muted-foreground">جارِ التحميل...</div>;
  }

  if (!canManage) {
    return (
      <div className="max-w-md mx-auto text-center py-12 space-y-3">
        <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground/50" />
        <h2 className="font-bold">ما عندك صلاحية إدارة هذا المقرر</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          إدارة المقرر مقصورة على الأدمن، أو الأستاذ المعيَّن له، أو الحساب اللي أنشأه.
          {user ? (
            <>
              <br />
              حسابك الحالي: {isAdmin ? "أدمن" : "مو أدمن"} — منشئ المقرر:{" "}
              {course.created_by === user.id ? "أنت" : "غيرك"} — الأستاذ المعيَّن:{" "}
              {course.teacher_id === user.id ? "أنت" : course.teacher_id ? "غيرك" : "لا يوجد"}
            </>
          ) : null}
        </p>
        <Link to="/courses/$id" params={{ id }} search={{ tab: undefined }}>
          <Button variant="outline" size="sm">
            رجوع لصفحة المقرر
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link
          to="/courses/$id"
          params={{ id }}
          search={{ tab: undefined }}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowRight className="w-4 h-4" /> رجوع لصفحة المقرر
        </Link>
        <Link to="/courses/$id" params={{ id }} search={{ tab: undefined }}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Eye className="w-3.5 h-3.5" /> معاينة كما يراها الطلاب
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">إدارة المقرر</h1>
          <p className="text-xs text-muted-foreground">{course.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">معلومات المقرر</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">اسم المقرر</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">الوصف أو المفردات</Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">التخصص</Label>
              <Select value={major} onValueChange={setMajor}>
                <SelectTrigger>
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
              <Label className="text-xs font-semibold text-foreground/80">السنة</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">الفصل</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> الأستاذ المسؤول
              </Label>
              <Select
                value={teacherId || "none"}
                onValueChange={(v) => setTeacherId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="بدون أستاذ محدد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون أستاذ محدد</SelectItem>
                  {(teachers ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                متاح للأدمن فقط — يحدّد مين يقدر يدير هذا المقرر إضافة لصاحب الإنشاء الأصلي.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => saveInfo.mutate()} disabled={saveInfo.isPending || !name.trim()}>
              {saveInfo.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              حفظ التعديلات
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="links">
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
          <LinksTab courseId={id} canEdit={true} />
        </TabsContent>
        <TabsContent value="files" className="pt-3">
          <FilesTab courseId={id} canEdit={true} />
        </TabsContent>
        <TabsContent value="schedule" className="pt-3">
          <ScheduleTab
            course={{
              id: course.id,
              schedule: course.schedule as unknown as ScheduleEntry[] | null,
            }}
            canEdit={true}
            onSaved={() => qc.invalidateQueries({ queryKey: ["course", id] })}
          />
        </TabsContent>
        <TabsContent value="updates" className="pt-3">
          <UpdatesTab courseId={id} canEdit={true} />
        </TabsContent>
      </Tabs>

      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-destructive flex items-center gap-1.5">
            <Trash2 className="w-4 h-4" /> منطقة الخطر
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            حذف المقرر يمسح كل الملفات والروابط والإعلانات المرتبطة به نهائيًا.
          </p>
          <DeleteCourseDialog
            onDelete={() => deleteCourse.mutate()}
            isPending={deleteCourse.isPending}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Badge variant="outline" className="text-[11px]">
          آخر تحديث: {new Date(course.updated_at ?? course.created_at).toLocaleString("ar")}
        </Badge>
      </div>
    </div>
  );
}
