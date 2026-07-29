import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubAdminRestrictions } from "@/components/admin/admin-shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, BookOpen, Users, FileText, Link2, Search, Trash2, Eye } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

interface CourseRow {
  [key: string]: string | number | null | undefined;
  id: string;
  name: string;
  major: string;
  year: number;
  semester: number;
  teacher_name: string;
  files_count: number;
  links_count: number;
  created_at: string;
}

export function CoursesManagementTab() {
  const navigate = useNavigate();
  const { isSubAdmin } = useSubAdminRestrictions();
  const [search, setSearch] = useState("");
  const [majorFilter, setMajorFilter] = useState<string>("all");

  const { data: courses, isLoading } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      try {
        const r = await (supabase.rpc as any)("get_courses_with_counts");
        if (!r.error && r.data) return (r.data ?? []) as CourseRow[];
      } catch {}
      const { data: raw } = await supabase.from("courses").select("id, name, major, year, semester, teacher_id, created_at").order("created_at", { ascending: false }).limit(200);
      if (!raw) return [];
      const teacherIds = Array.from(new Set(raw.map((c) => c.teacher_id).filter((x): x is string => !!x)));
      const { data: teachers } = teacherIds.length ? await supabase.from("profiles").select("id, full_name").in("id", teacherIds) : { data: [] };
      const tMap = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));

      const rows: CourseRow[] = await Promise.all(
        raw.map(async (c) => {
          const [fRes, lRes] = await Promise.all([
            supabase.from("course_links").select("id", { count: "exact", head: true }).eq("course_id", c.id).eq("link_type", "file"),
            supabase.from("course_links").select("id", { count: "exact", head: true }).eq("course_id", c.id).is("link_type", null),
          ]);
          return {
            id: c.id,
            name: c.name,
            major: c.major ?? "",
            year: c.year ?? 0,
            semester: c.semester ?? 0,
            teacher_name: tMap.get(c.teacher_id ?? "") ?? "—",
            files_count: fRes.count ?? 0,
            links_count: lRes.count ?? 0,
            created_at: c.created_at,
          };
        }),
      );
      return rows;
    },
  });

  const filtered = (courses ?? []).filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.teacher_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (majorFilter !== "all" && c.major !== majorFilter) return false;
    return true;
  });

  const majorOptions = Array.from(new Set((courses ?? []).map((c) => c.major).filter(Boolean)));

  if (isLoading) {
    return (
      <Card className="border border-border/40 shadow-sm rounded-xl">
        <CardContent className="p-6">
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full" />
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن مقرر..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 text-sm"
          />
        </div>
        <select
          value={majorFilter}
          onChange={(e) => setMajorFilter(e.target.value)}
          className="h-9 text-sm border border-border rounded-md bg-background px-3"
        >
          <option value="all">كل التخصصات</option>
          {majorOptions.map((m) => (
            <option key={m} value={m}>{m === "it" ? "تقنية معلومات" : m === "is" ? "نظم معلومات" : m === "se" ? "هندسة برمجيات" : m}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => exportCsv(filtered.length > 0 ? filtered : courses ?? [], "courses_export")}>
          <FileText className="w-3.5 h-3.5" />
          تصدير CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((course) => (
          <Card key={course.id} className="border border-border/40 shadow-sm rounded-xl hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{course.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{course.teacher_name}</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {course.major === "it" ? "تقنية معلومات" : course.major === "is" ? "نظم معلومات" : course.major === "se" ? "هندسة برمجيات" : course.major || "—"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />سنة {course.year}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />فصل {course.semester}</span>
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{course.files_count}</span>
                <span className="flex items-center gap-1"><Link2 className="w-3 h-3" />{course.links_count}</span>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-border/20">
                  <Button variant="outline" size="sm" className="h-7 text-[11px] flex-1 gap-1" onClick={() => navigate({ to: "/courses/$id", params: { id: course.id }, search: { tab: undefined } })}>
                  <Eye className="w-3 h-3" />عرض
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">لا توجد مقررات تطابق البحث</p>
      )}
    </div>
  );
}
