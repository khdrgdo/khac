import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureAdminOrTeacherRole } from "@/lib/roleGuard";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MAJORS, YEARS, SEMESTERS } from "@/lib/college";

export function EditCourseDialog({
  course,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: {
  course?: {
    id: string;
    name: string;
    description?: string | null;
    major: string;
    year: number;
    semester: number;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? (externalOnOpenChange || (() => {})) : setInternalOpen;

  const [name, setName] = useState(course?.name || "");
  const [desc, setDesc] = useState(course?.description || "");
  const [major, setMajor] = useState(course?.major || "it");
  const [year, setYear] = useState(String(course?.year || 1));
  const [semester, setSemester] = useState(String(course?.semester || 1));

  useEffect(() => {
    if (course) {
      setName(course.name || "");
      setDesc(course.description || "");
      setMajor(course.major || "it");
      setYear(String(course.year || 1));
      setSemester(String(course.semester || 1));
    }
  }, [course]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!course?.id) return;
      if (user?.id) await ensureAdminOrTeacherRole(user.id);
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
      toast.success("تم تحديث بيانات المقرر بنجاح");
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["course", course?.id] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "فشل في تحديث المقرر"),
  });

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> تعديل
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="dir-rtl rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>تعديل المادة الدراسية</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>اسم المادة</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>وصف المادة</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>التخصص</Label>
              <Select value={major} onValueChange={setMajor}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAJORS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>السنة</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الفصل</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 rounded-xl"
            disabled={!name.trim() || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : "حفظ التعديلات"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
