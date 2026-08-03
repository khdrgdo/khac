import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { renderMarkdownContent } from "@/lib/markdown";
import type { CourseUpdate } from "@/components/courses/course-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Megaphone, Trash2, Clock, Loader2, Pencil } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

/* Course Announcements / Updates */
export function UpdatesTab({ courseId, canEdit }: { courseId: string; canEdit: boolean }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [updateToDelete, setUpdateToDelete] = useState<CourseUpdate | null>(null);
  const [editingUpdate, setEditingUpdate] = useState<CourseUpdate | null>(null);
  const [editContent, setEditContent] = useState("");

  const { data: updates, isLoading } = useQuery({
    queryKey: ["course_updates", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_updates")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });

      const rows = (data ?? []) as CourseUpdate[];
      const authorIds = Array.from(new Set(rows.map((r) => r.author_id).filter((x): x is string => !!x)));
      if (!authorIds.length) return rows.map((r) => ({ ...r, author_name: "الأستاذ" }));

      const { data: authors } = await supabase.rpc("get_public_profiles", { _ids: authorIds });
      const m = new Map(
        (authors ?? []).map((a: { id: string; full_name: string }) => [a.id, a.full_name]),
      );
      return rows.map((r) => ({ ...r, author_name: (r.author_id ? m.get(r.author_id) : null) ?? "الأستاذ" }));
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      if (!user || !content.trim()) throw new Error("يرجى كتابة نص الإعلان");
      const { error } = await supabase
        .from("course_updates")
        .insert({ course_id: courseId, author_id: user.id, content: content.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      toast.success("تم نشر الإعلان للطلاب بنجاح");
      qc.invalidateQueries({ queryKey: ["course_updates", courseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (uid: string) => {
      await supabase.from("course_updates").delete().eq("id", uid);
    },
    onSuccess: () => {
      toast.success("تم حذف الإعلان");
      qc.invalidateQueries({ queryKey: ["course_updates", courseId] });
    },
  });

  const editUpdate = useMutation({
    mutationFn: async () => {
      if (!editingUpdate) return;
      const { error } = await supabase
        .from("course_updates")
        .update({ content: editContent.trim() })
        .eq("id", editingUpdate.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تعديل الإعلان بنجاح");
      qc.invalidateQueries({ queryKey: ["course_updates", courseId] });
      setEditingUpdate(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {canEdit && (
        <Card className="border-primary/30 bg-card">
          <CardContent className="p-4 space-y-3">
            <Label className="text-xs font-semibold text-foreground">
              نشر إعلان جديد للطلاب في هذا المقرر
            </Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="اكتب إعلاناً مهماً أو تنبيهاً لطلاب المقررات (مثال: تأجيل محاضرة، موعد تسليم التكليف...)"
              className="resize-none rounded-xl text-xs"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => post.mutate()}
                disabled={!content.trim() || post.isPending}
                className="rounded-xl font-semibold text-xs gap-1.5"
              >
                {post.isPending && <Loader2 className="w-4 h-4 animate-spin" />} نشر الإعلان الآن
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !updates || updates.length === 0 ? (
        <div className="text-center py-8 border rounded-2xl border-dashed bg-muted/5">
          <Megaphone className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">لا توجد إعلانات منشورة لهذا المقرر بعد</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {updates.map((u) => (
            <Card key={u.id} className="border-muted/60">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <strong className="text-foreground font-semibold">{u.author_name}</strong>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />{" "}
                      {formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: ar })}
                    </span>
                  </div>

                  {(isAdmin || u.author_id === user?.id) && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:bg-muted"
                        onClick={() => {
                          setEditingUpdate(u);
                          setEditContent(u.content);
                        }}
                        title="تعديل الإعلان"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => setUpdateToDelete(u)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                  {renderMarkdownContent(u.content)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Announcement Dialog */}
      <Dialog open={!!editingUpdate} onOpenChange={() => setEditingUpdate(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>تعديل الإعلان</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <Label className="text-xs font-semibold">نص الإعلان</Label>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={5}
              className="resize-none rounded-xl text-sm mt-2"
            />
          </div>
          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setEditingUpdate(null)} className="rounded-xl">
              إلغاء
            </Button>
            <Button
              onClick={() => editUpdate.mutate()}
              disabled={!editContent.trim() || editUpdate.isPending}
              className="rounded-xl font-semibold"
            >
              {editUpdate.isPending && <Loader2 className="w-4 h-4 animate-spin ml-1.5" />}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!updateToDelete} onOpenChange={() => setUpdateToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الإعلان</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف هذا الإعلان نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (updateToDelete) del.mutate(updateToDelete.id);
                setUpdateToDelete(null);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
