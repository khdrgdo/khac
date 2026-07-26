import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type CourseData } from "@/components/courses/course-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { majorLabel, MAJORS, YEARS, SEMESTERS } from "@/lib/college";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
