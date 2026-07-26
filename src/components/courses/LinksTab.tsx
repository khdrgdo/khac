import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { type CourseFile } from "@/components/courses/course-types";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExternalLink, Plus, Trash2, Loader2, MessageSquare, Clock } from "lucide-react";
import { parseTitleAndNote, formatTitleAndNote } from "@/lib/courseUtils";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

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
