import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type ScheduleEntry } from "@/components/courses/course-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";

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
