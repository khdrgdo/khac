import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isSuspended } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, Loader2, Send, Trash2, CheckCircle2 } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/posts/$id")({
  component: PostDetailPage,
});

interface CommentAuthor {
  full_name: string;
  avatar_url: string | null;
  verified?: boolean;
}

interface Comment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  content: string;
  created_at: string;
}

function PostDetailPage() {
  const { id } = useParams({ from: "/_authenticated/posts/$id" });
  const { user, isAdmin, profile } = useAuth();
  const suspended = isSuspended(profile);
  const qc = useQueryClient();

  const { data: post } = useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      const { data: p } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
      if (!p) return null;
      const { data: authorRows } = await supabase.rpc("get_public_profiles", {
        _ids: [p.author_id],
      });
      const author = (authorRows && authorRows[0]) ?? null;
      return { ...p, author };
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", id],
    queryFn: async (): Promise<(Comment & { author: CommentAuthor | null })[]> => {
      const { data: rows } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", id)
        .order("created_at");
      const list = rows ?? [];
      if (list.length === 0) return [];
      const ids = Array.from(new Set(list.map((r: Comment) => r.author_id)));
      const { data: authors } = await supabase.rpc("get_public_profiles", { _ids: ids });
      const map = new Map((authors ?? []).map((a) => [a.id, a]));
      return list.map((c: Comment) => ({
        ...c,
        author: (map.get(c.author_id) as CommentAuthor) ?? null,
      }));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`post-${id}-comments`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["comments", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [text, setText] = useState("");

  const commentMut = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (suspended) throw new Error("حسابك موقوف مؤقتًا — لا يمكن التعليق");
      const { error } = await supabase.from("comments").insert({
        post_id: id,
        author_id: user.id,
        content: text.trim(),
        parent_id: replyTo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["comments", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteComment = useMutation({
    mutationFn: async (cid: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", cid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", id] }),
  });

  const acceptAnswer = useMutation({
    mutationFn: async (commentId: string | null) => {
      const { error } = await supabase
        .from("posts")
        .update({ accepted_answer_id: commentId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, commentId) => {
      toast.success(commentId ? "تم اعتماد الإجابة كحل" : "تم إلغاء اعتماد الحل");
      qc.invalidateQueries({ queryKey: ["post", id] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!post)
    return <div className="text-center py-10 text-sm text-muted-foreground">جارِ التحميل...</div>;

  const roots = (comments ?? []).filter((c) => !c.parent_id);
  const childrenOf = (pid: string) => (comments ?? []).filter((c) => c.parent_id === pid);
  const authorName = post.author?.full_name ?? "مستخدم";

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        to="/feed"
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowRight className="w-4 h-4" /> العودة
      </Link>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.author?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {authorName.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold flex items-center gap-1">
                {authorName}
                {post.author?.verified && <VerifiedBadge />}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ar })}
              </div>
            </div>
          </div>
          {post.post_type === "question" && (
            <div className="mt-3">
              {post.accepted_answer_id ? (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> سؤال محلول
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  سؤال مفتوح — بانتظار الحل
                </span>
              )}
            </div>
          )}
          <p className="mt-3 whitespace-pre-wrap text-[15px]">{post.content}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-3">
          {replyTo && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              يجري الرد على تعليق{" "}
              <button className="text-primary" onClick={() => setReplyTo(null)}>
                إلغاء
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder="اكتب تعليقًا..."
              className="resize-none"
            />
            <Button
              onClick={() => commentMut.mutate()}
              disabled={!text.trim() || commentMut.isPending}
              size="sm"
            >
              {commentMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {roots.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-6">لا توجد تعليقات بعد.</div>
        )}
        {roots.map((c) => (
          <CommentItem
            key={c.id}
            c={c}
            children={childrenOf(c.id)}
            onReply={(cid) => setReplyTo(cid)}
            onDelete={(cid) => deleteComment.mutate(cid)}
            canDelete={(a) => a === user?.id || isAdmin}
            isQuestion={post.post_type === "question"}
            isPostAuthor={user?.id === post.author_id}
            acceptedAnswerId={post.accepted_answer_id}
            onAccept={(cid) => acceptAnswer.mutate(cid)}
            acceptPending={acceptAnswer.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function CommentItem({
  c,
  children,
  onReply,
  onDelete,
  canDelete,
  isQuestion,
  isPostAuthor,
  acceptedAnswerId,
  onAccept,
  acceptPending,
}: {
  c: {
    id: string;
    author_id: string;
    content: string;
    created_at: string;
    author: CommentAuthor | null;
  };
  children: {
    id: string;
    author_id: string;
    content: string;
    created_at: string;
    author: CommentAuthor | null;
  }[];
  onReply: (cid: string) => void;
  onDelete: (cid: string) => void;
  canDelete: (authorId: string) => boolean;
  isQuestion?: boolean;
  isPostAuthor?: boolean;
  acceptedAnswerId?: string | null;
  onAccept?: (cid: string | null) => void;
  acceptPending?: boolean;
}) {
  const name = c.author?.full_name ?? "مستخدم";
  const isAccepted = isQuestion && acceptedAnswerId === c.id;
  const canAccept = isQuestion && isPostAuthor && !isAccepted && !acceptedAnswerId;
  return (
    <div>
      <Card className={isAccepted ? "border-emerald-500 border-2" : undefined}>
        <CardContent className="p-3">
          {isAccepted && (
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> الحل المعتمد
            </div>
          )}
          <div className="flex items-start gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={c.author?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-sm inline-flex items-center gap-1">
                  {name}
                  {c.author?.verified && <VerifiedBadge />}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ar })}
                </span>
              </div>
              <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.content}</p>
              <div className="flex gap-3 mt-1 items-center flex-wrap">
                <button
                  onClick={() => onReply(c.id)}
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  رد
                </button>
                {canAccept && (
                  <button
                    onClick={() => onAccept?.(c.id)}
                    disabled={acceptPending}
                    className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3 h-3" /> اعتماد كحل
                  </button>
                )}
                {isAccepted && isPostAuthor && (
                  <button
                    onClick={() => onAccept?.(null)}
                    disabled={acceptPending}
                    className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    إلغاء الاعتماد
                  </button>
                )}
                {canDelete(c.author_id) && (
                  <button
                    onClick={() => onDelete(c.id)}
                    className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> حذف
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {children.length > 0 && (
        <div className="ms-8 mt-2 space-y-2">
          {children.map((ch) => {
            const cn = ch.author?.full_name ?? "مستخدم";
            return (
              <Card key={ch.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={ch.author?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {cn.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-xs inline-flex items-center gap-1">
                          {cn}
                          {ch.author?.verified && <VerifiedBadge />}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(ch.created_at), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </span>
                      </div>
                      <p className="text-sm mt-0.5 whitespace-pre-wrap">{ch.content}</p>
                      {canDelete(ch.author_id) && (
                        <button
                          onClick={() => onDelete(ch.id)}
                          className="text-xs text-muted-foreground hover:text-destructive mt-1 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> حذف
                        </button>
                      )}
                    </div>
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
