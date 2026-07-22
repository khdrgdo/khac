import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { majorLabel } from "@/lib/college";
import { BookOpen, ChevronLeft, Search, ShieldCheck, UserX, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/courses/mine")({
  component: MyCoursesPage,
});

interface CourseRow {
  id: string;
  name: string;
  major: "it" | "is" | "se";
  year: number;
  semester: number;
  teacher_id: string | null;
}

function MyCoursesPage() {
  const { user, isAdmin, isTeacher, loading } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin && !isTeacher) {
      navigate({ to: "/feed", replace: true });
    }
  }, [loading, isAdmin, isTeacher, navigate]);

  const { data: courses, isLoading } = useQuery({
    queryKey: ["my-courses", user?.id, isAdmin],
    enabled: !!user && (isAdmin || isTeacher),
    queryFn: async () => {
      let query = supabase
        .from("courses")
        .select("id, name, major, year, semester, teacher_id")
        .order("major")
        .order("year")
        .order("semester");
      if (!isAdmin) query = query.eq("teacher_id", user!.id);
      const { data } = await query;
      return (data ?? []) as CourseRow[];
    },
  });

  if (loading || (!isAdmin && !isTeacher)) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filtered = (courses ?? []).filter((c) =>
    q.trim() ? c.name.toLowerCase().includes(q.trim().toLowerCase()) : true,
  );

  const grouped = new Map<string, CourseRow[]>();
  filtered.forEach((c) => {
    const key = `${c.major}-${c.year}`;
    const arr = grouped.get(key) ?? [];
    arr.push(c);
    grouped.set(key, arr);
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">كورساتي</h1>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? "كل المقررات — اختر مقررًا لإدارته" : "المقررات المسندة إليك"}
          </p>
        </div>
      </div>

      {(courses ?? []).length > 3 && (
        <div className="relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن مقرر..."
            className="pr-9"
          />
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <UserX className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "لا توجد مقررات مطابقة"
                : "ما عندك مقررات مسندة لك بعد — تواصل مع الأدمن ليعيّنك على مقرر"}
            </p>
          </CardContent>
        </Card>
      )}

      {[...grouped.entries()].map(([key, list]) => {
        const [major, year] = key.split("-");
        return (
          <div key={key} className="space-y-1.5">
            <div className="flex items-center gap-2 px-1">
              <Badge variant="secondary">{majorLabel(major)}</Badge>
              <span className="text-xs text-muted-foreground">السنة {year}</span>
            </div>
            {list.map((c) => (
              <Link
                key={c.id}
                to="/courses/$id/manage"
                params={{ id: c.id }}
                search={{ tab: undefined }}
              >
                <Card className="hover:shadow-sm hover:border-primary/40 transition-all">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground">فصل {c.semester}</div>
                    </div>
                    {!c.teacher_id && (
                      <Badge variant="outline" className="text-amber-600 text-[10px]">
                        بدون أستاذ
                      </Badge>
                    )}
                    <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}
