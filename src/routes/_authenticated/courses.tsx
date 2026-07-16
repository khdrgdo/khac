import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MAJORS, YEARS, SEMESTERS, majorLabel } from "@/lib/college";
import { BookOpen, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/courses")({
  component: CoursesPage,
});

function CoursesPage() {
  const { profile, isTeacher, isAdmin } = useAuth();
  const [majorFilter, setMajorFilter] = useState<string>(profile?.major ?? "all");
  const [yearFilter, setYearFilter] = useState<string>("all");

  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses", majorFilter, yearFilter],
    queryFn: async () => {
      let q = supabase.from("courses").select("*").order("year").order("semester");
      if (majorFilter !== "all") q = q.eq("major", majorFilter as "it" | "is" | "se");
      if (yearFilter !== "all") q = q.eq("year", Number(yearFilter));
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">الكورسات</h1>
            <p className="text-xs text-muted-foreground">روابط الفيديوهات والمواد لكل تخصص وسنة</p>
          </div>
        </div>
        {(isTeacher || isAdmin) && <NewCourseDialog />}
      </div>

      <Card>
        <CardContent className="p-3 flex gap-2 flex-wrap">
          <Select value={majorFilter} onValueChange={setMajorFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل التخصصات</SelectItem>
              {MAJORS.map((m) => <SelectItem key={m.code} value={m.code}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل السنوات</SelectItem>
              {YEARS.map((y) => <SelectItem key={y} value={String(y)}>السنة {y}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : !courses || courses.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">لا توجد كورسات مطابقة.</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {courses.map((c) => (
            <Link key={c.id} to="/courses/$id" params={{ id: c.id }}>
              <Card className="hover:border-primary/50 transition h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <Badge variant="secondary" className="shrink-0">السنة {c.year} • ف{c.semester}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{majorLabel(c.major)}</div>
                  {c.description && <p className="mt-2 text-sm line-clamp-2 text-muted-foreground">{c.description}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NewCourseDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [major, setMajor] = useState("");
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("1");
  const { user } = useAuth();
  const qc = useQueryClient();

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
      toast.success("تمت إضافة الكورس");
      qc.invalidateQueries({ queryKey: ["courses"] });
      setOpen(false);
      setName(""); setDesc(""); setMajor(""); setYear("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4" /> كورس جديد</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة كورس</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>اسم الكورس</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>الوصف</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>التخصص</Label>
              <Select value={major} onValueChange={setMajor}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{MAJORS.map((m) => <SelectItem key={m.code} value={m.code}>{m.label}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>السنة</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>الفصل</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEMESTERS.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => mut.mutate()}
            disabled={!name || !major || !year || mut.isPending}
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />} حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
