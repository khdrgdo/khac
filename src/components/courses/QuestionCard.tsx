import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { type CourseQuestionPost, type CoursePublicProfile } from "@/components/courses/course-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock, Send, Trash2, Loader2 } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { createNotification } from "@/lib/notificationsStore";
import { renderMarkdownContent } from "@/lib/markdown";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

export function QuestionCard({
  q,
  courseId,
  isTeacher,
  canDelete,
  onDelete,
  teacherId,
}: {
  q: CourseQuestionPost;
  courseId: string;
  isTeacher: boolean;
  canDelete: boolean;
  onDelete: () => void;
  teacherId?: string | null;
}) {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const qc = useQueryClient();
  const [replyText, setReplyText] = useState("");
  const [showReplies, setShowReplies] = useState(true);

  // Fetch comments for this question
  const { data: comments, isLoading: loadingComments } = useQuery({
    queryKey: ["course_question_comments", q.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", q.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const cList = data ?? [];
      const authorIds = Array.from(new Set(cList.map((c) => c.author_id)));
      if (!authorIds.length) return [];

      const { data: profiles } = await supabase.rpc("get_public_profiles", { _ids: authorIds });
      const pMap = new Map((profiles ?? []).map((p: CoursePublicProfile) => [p.id, p]));

      return cList.map((c) => ({
        ...c,
        author: pMap.get(c.author_id) ?? null,
      }));
    },
  });

  // Add comment
  const addComment = useMutation({
    mutationFn: async () => {
      if (!user || !replyText.trim()) throw new Error("يرجى كتابة الرد");
      if (isSubAdmin)
        throw new Error(
          "حساب المشرف المساعد (سب أدمن) مخصص للإشراف والمراقبة فقط ولا يملك صلاحية المشاركة أو التعليق.",
        );
      const { error } = await supabase.from("comments").insert({
        post_id: q.id,
        author_id: user.id,
        content: replyText.trim(),
      });
      if (error) throw error;

      if (q.author_id !== user.id) {
        createNotification({
          recipientId: q.author_id,
          actorId: user.id,
          actorName: user.user_metadata?.full_name || "زميل",
          type: "post_comment",
          title: "رد جديد على سؤالك في المقرر 💬",
          body: replyText.trim(),
          link: `/courses/${courseId}?tab=discussions`,
        });
      }
    },
    onSuccess: () => {
      setReplyText("");
      toast.success("تم إضافة إجابتك/ردك");
      qc.invalidateQueries({ queryKey: ["course_question_comments", q.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete comment
  const deleteComment = useMutation({
    mutationFn: async (cid: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", cid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الرد");
      qc.invalidateQueries({ queryKey: ["course_question_comments", q.id] });
    },
  });

  const authorName = q.author?.full_name ?? "مستخدم";

  return (
    <Card className="border-muted/80 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserAvatar
              avatarUrl={q.author?.avatar_url}
              fullName={authorName}
              className="w-9 h-9"
            />
            <div className="min-w-0">
              <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                <span>{authorName}</span>
                {q.author?.verified && <VerifiedBadge />}
                {isTeacher && (
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary text-[10px] px-1.5 py-0 font-medium"
                  >
                    أستاذ المقرر
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(q.created_at), { addSuffix: true, locale: ar })}
              </p>
            </div>
          </div>

          {canDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="text-sm font-medium text-foreground whitespace-pre-wrap leading-relaxed">
          {renderMarkdownContent(q.cleanContent)}
        </div>

        {/* Action / Comments Header */}
        <div className="flex items-center justify-between border-t pt-2 mt-2 text-xs text-muted-foreground">
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center gap-1 hover:text-primary font-medium"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>الإجابات والردود ({comments?.length ?? 0})</span>
          </button>
        </div>

        {/* Replies / Comments */}
        {showReplies && (
          <div className="space-y-3 pt-2">
            {loadingComments ? (
              <div className="flex justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : comments && comments.length > 0 ? (
              <div className="space-y-2 border-r-2 border-primary/20 pr-3 mr-1">
                {comments.map((c) => {
                  const cName = c.author?.full_name ?? "مستخدم";
                  const isCommentTeacher = c.author_id === teacherId;
                  const canDelComment = isAdmin || c.author_id === user?.id;

                  return (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-xl bg-muted/30 border border-muted/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            avatarUrl={c.author?.avatar_url}
                            fullName={cName}
                            className="w-6 h-6"
                          />
                          <span className="font-semibold text-xs text-foreground">{cName}</span>
                          {isCommentTeacher && (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] px-1.5 py-0"
                            >
                              أستاذ المقرر
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            •{" "}
                            {formatDistanceToNow(new Date(c.created_at), {
                              addSuffix: true,
                              locale: ar,
                            })}
                          </span>
                        </div>

                        {canDelComment && (
                          <button
                            onClick={() => deleteComment.mutate(c.id)}
                            className="text-muted-foreground hover:text-destructive text-xs"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                                            <div className="text-xs text-foreground/90 whitespace-pre-wrap">
                        {renderMarkdownContent(c.content)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Add Answer Input */}
            {isSubAdmin ? (
              <p className="text-xs text-muted-foreground font-semibold py-2">
                حساب المشرف المساعد (سب أدمن) مخصص للإشراف والمراقبة فقط ولا يملك صلاحية المشاركة أو
                التعليق.
              </p>
            ) : (
              <div className="flex gap-2 items-center pt-1">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="اكتب إجابة أو تعليقاً على هذا السؤال..."
                  className="h-9 text-xs rounded-xl flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (replyText.trim()) addComment.mutate();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => addComment.mutate()}
                  disabled={!replyText.trim() || addComment.isPending}
                  className="h-9 px-3 rounded-xl gap-1 text-xs font-semibold"
                >
                  {addComment.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>إجابة</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
