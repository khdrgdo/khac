import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { type CourseQuestionPost, type CoursePublicProfile } from "@/components/courses/course-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/RichTextEditor";
import { HelpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { QuestionCard } from "@/components/courses/QuestionCard";

/* Course Questions & Discussions Tab */
export function DiscussionsTab({
  courseId,
  teacherId,
  canEdit,
}: {
  courseId: string;
  teacherId?: string | null;
  canEdit?: boolean;
}) {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const qc = useQueryClient();
  const [questionContent, setQuestionContent] = useState("");
  const [askAnonymously, setAskAnonymously] = useState(false);

  const coursePrefix = `[course:${courseId}]`;

  // Fetch course questions (posts)
  const { data: questions, isLoading } = useQuery({
    queryKey: ["course_questions", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .ilike("content", `${coursePrefix}%`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const postsData = data ?? [];
      const authorIds = Array.from(new Set(postsData.map((p) => p.author_id).filter((x): x is string => !!x)));
      if (!authorIds.length) return [];

      const { data: profiles } = await supabase.rpc("get_public_profiles", { _ids: authorIds });
      const profileMap = new Map((profiles ?? []).map((p: CoursePublicProfile) => [p.id, p]));

      return postsData.map((p) => ({
        ...p,
        author: (p.author_id ? profileMap.get(p.author_id) : null) ?? null,
        cleanContent: p.content.replace(coursePrefix, "").trim(),
      }));
    },
  });

  // Post question mutation
  const postQuestion = useMutation({
    mutationFn: async () => {
      if (!user || !questionContent.trim()) throw new Error("يرجى كتابة نص السؤال");
      if (isSubAdmin)
        throw new Error(
          "حساب المشرف المساعد (سب أدمن) مخصص للإشراف والمراقبة فقط من لوحة التحكم، ولا يملك صلاحية طرح أسئلة.",
        );
      const fullText = `${coursePrefix} ${questionContent.trim()}`;
      const { error } = await supabase.rpc("create_post_as", {
        _content: fullText,
        _post_type: "question",
        _anonymous: askAnonymously,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setQuestionContent("");
      setAskAnonymously(false);
      toast.success("تم نشر سؤالك في المقرر بنجاح");
      qc.invalidateQueries({ queryKey: ["course_questions", courseId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Delete question
  const deleteQuestion = useMutation({
    mutationFn: async (qid: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", qid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف السؤال");
      qc.invalidateQueries({ queryKey: ["course_questions", courseId] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Ask Question Card */}
      {isSubAdmin ? (
        <Card className="border-muted bg-card">
          <CardContent className="p-4 text-center text-xs text-muted-foreground font-semibold">
            حساب المشرف المساعد (سب أدمن) مخصص للإشراف والمراقبة فقط ولا يملك صلاحية طرح الأسئلة أو
            المشاركة.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/30 bg-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <HelpCircle className="w-5 h-5 text-primary" />
              <span>طرح سؤال أو استفسار حول المقرر</span>
            </div>
            <RichTextEditor
              content={questionContent}
              onChange={setQuestionContent}
              placeholder="اكتب سؤالك هنا ليستطيع الطلاب وأستاذ المقرر الإجابة عليه..."
            />
            <div className="flex justify-between items-center gap-2">
              <button
                type="button"
                onClick={() => setAskAnonymously((v) => !v)}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${
                  askAnonymously
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                سؤال كمجهول
              </button>
              <Button
                size="sm"
                onClick={() => postQuestion.mutate()}
                disabled={!questionContent.trim() || postQuestion.isPending}
                className="rounded-xl font-semibold text-xs gap-1.5"
              >
                {postQuestion.isPending && <Loader2 className="w-4 h-4 animate-spin" />} إرسال
                السؤال
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Questions List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !questions || questions.length === 0 ? (
        <div className="text-center py-10 border rounded-2xl border-dashed bg-muted/5">
          <HelpCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">
            لا توجد أسئلة أو نقاشات في هذا المقرر بعد
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            كن أول من يطرح سؤالاً لمناقشته مع الزملاء والمدرس!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => {
            const isTeacher = q.author_id === teacherId;
            const canDel = isAdmin || q.author_id === user?.id;

            return (
              <QuestionCard
                key={q.id}
                q={q}
                courseId={courseId}
                isTeacher={isTeacher}
                canDelete={canDel}
                onDelete={() => deleteQuestion.mutate(q.id)}
                teacherId={teacherId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
