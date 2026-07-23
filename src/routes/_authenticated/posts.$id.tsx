import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isSuspended } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/UserAvatar";
import { ArrowRight, Loader2, Send, Trash2, CheckCircle2, Pencil } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { createNotification } from "@/lib/notificationsStore";

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
  const { user, isAdmin, isSubAdmin, profile } = useAuth();
  const suspended = isSuspended(profile);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const deletePost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast.success("تم حذف المنشور بنجاح");
      navigate({ to: "/feed" });
    },
    onError: (e: Error) => toast.error(e.message || "فشل في حذف المنشور"),
  });

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
    if (post?.content?.startsWith("[course:")) {
      const match = post.content.match(/^\[course:([^\]]+)\]/);
      if (match && match[1]) {
        navigate({
          to: "/courses/$id",
          params: { id: match[1] },
          search: { tab: "discussions" },
          replace: true,
        });
      }
    }
  }, [post, navigate]);

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
      if (isSubAdmin)
        throw new Error(
          "حساب المشرف المساعد (سب أدمن) مخصص للإشراف والمراقبة فقط من لوحة التحكم، ولا يملك صلاحية التعليق.",
        );
      if (suspended) throw new Error("حسابك موقوف مؤقتًا — لا يمكن التعليق");
      const commentContent = text.trim();
      const { error } = await supabase.from("comments").insert({
        post_id: id,
        author_id: user.id,
        content: commentContent,
        parent_id: replyTo,
      });
      if (error) throw error;

      // Trigger notifications
      if (replyTo) {
        const parentComment = comments?.find((c) => c.id === replyTo);
        if (parentComment && parentComment.author_id !== user.id) {
          createNotification({
            recipientId: parentComment.author_id,
            actorId: user.id,
            actorName: profile?.full_name,
            actorAvatar: profile?.avatar_url,
            type: "comment_reply",
            title: `${profile?.full_name ?? "زميل"} رد على تعليقك 💬`,
            body: commentContent,
            link: `/posts/${id}`,
          });
        }
      } else if (post && post.author_id !== user.id) {
        createNotification({
          recipientId: post.author_id,
          actorId: user.id,
          actorName: profile?.full_name,
          actorAvatar: profile?.avatar_url,
          type: "post_comment",
          title: `${profile?.full_name ?? "زميل"} علق على منشورك 📝`,
          body: commentContent,
          link: `/posts/${id}`,
        });
      }
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

      if (commentId && user) {
        const targetComment = comments?.find((c) => c.id === commentId);
        if (targetComment && targetComment.author_id !== user.id) {
          createNotification({
            recipientId: targetComment.author_id,
            actorId: user.id,
            actorName: profile?.full_name,
            actorAvatar: profile?.avatar_url,
            type: "points_awarded",
            title: "تم اختيار إجابتك كحل نموذجي! 🏆",
            body: "حصلت على +20 نقطة تميز أكاديمي بعد اختيار صاحب السؤال لإجابتك.",
            link: `/posts/${id}`,
          });
        }
      }
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link to="/profile/$id" params={{ id: post.author_id }}>
                <UserAvatar
                  avatarUrl={post.author?.avatar_url}
                  fullName={authorName}
                  className="w-10 h-10"
                />
              </Link>
              <div>
                <Link
                  to="/profile/$id"
                  params={{ id: post.author_id }}
                  className="font-semibold flex items-center gap-1 hover:underline"
                >
                  {authorName}
                  {post.author?.verified && <VerifiedBadge />}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ar })}
                </div>
              </div>
            </div>
            {user && (user.id === post.author_id || isAdmin) && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                onClick={() => {
                  if (window.confirm("هل أنت متأكد من رغبتك في حذف هذا المنشور؟")) {
                    deletePost.mutate();
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
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

      {isSubAdmin ? (
        <Card>
          <CardContent className="p-4 text-center text-xs text-muted-foreground font-semibold">
            حساب المشرف المساعد (سب أدمن) مخصص للإشراف والمراقبة فقط ولا يملك صلاحية التعليق.
          </CardContent>
        </Card>
      ) : (
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
      )}

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

function CommentReactionsBar({ commentId }: { commentId: string }) {
  const { user } = useAuth();
  const storageKey = `cmt_reactions_${commentId}`;

  const [reactions, setReactions] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleEmoji = (emoji: string) => {
    if (!user) return;
    setReactions((prev) => {
      const current = prev[emoji] ?? [];
      const hasReacted = current.includes(user.id);
      const updated = hasReacted ? current.filter((id) => id !== user.id) : [...current, user.id];

      const newMap = { ...prev, [emoji]: updated };
      try {
        localStorage.setItem(storageKey, JSON.stringify(newMap));
      } catch (e) {
        console.warn(e);
      }
      return newMap;
    });
  };

  const EMOJIS = [
    { emoji: "👍", label: "إعجاب" },
    { emoji: "❤️", label: "حب" },
    { emoji: "💡", label: "مفيد" },
    { emoji: "❓", label: "سؤال" },
    { emoji: "😄", label: "ضحك" },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap my-1">
      {EMOJIS.map(({ emoji, label }) => {
        const users = reactions[emoji] ?? [];
        const count = users.length;
        const active = user ? users.includes(user.id) : false;

        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggleEmoji(emoji)}
            title={label}
            className={cn(
              "px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1 border transition-all",
              active
                ? "bg-primary/10 border-primary/40 text-primary font-bold scale-105"
                : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="text-[10px] font-medium">{count}</span>}
          </button>
        );
      })}
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
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const name = c.author?.full_name ?? "مستخدم";
  const isAccepted = isQuestion && acceptedAnswerId === c.id;
  const canAccept = isQuestion && isPostAuthor && !isAccepted && !acceptedAnswerId;
  const canEdit = !!user && (user.id === c.author_id || isAdmin);

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(c.content);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("comments")
        .update({ content: editText.trim() })
        .eq("id", c.id);
      if (error) throw error;
      toast.success("تم تعديل التعليق بنجاح");
      setIsEditing(false);
      qc.invalidateQueries({ queryKey: ["comments"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تعديل التعليق";
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

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
            <Link to="/profile/$id" params={{ id: c.author_id }}>
              <UserAvatar avatarUrl={c.author?.avatar_url} fullName={name} className="w-8 h-8" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <Link
                  to="/profile/$id"
                  params={{ id: c.author_id }}
                  className="font-medium text-sm inline-flex items-center gap-1 hover:underline"
                >
                  {name}
                  {c.author?.verified && <VerifiedBadge />}
                </Link>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ar })}
                </span>
              </div>

              {isEditing ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="text-xs rounded-xl"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={savingEdit || !editText.trim()}
                      className="h-7 text-xs rounded-lg px-3"
                    >
                      {savingEdit && <Loader2 className="w-3 h-3 animate-spin ml-1" />} حفظ التعديل
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsEditing(false);
                        setEditText(c.content);
                      }}
                      className="h-7 text-xs rounded-lg"
                    >
                      إلغاء
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.content}</p>
                  <CommentReactionsBar commentId={c.id} />
                </>
              )}

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
                {canEdit && !isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" /> تعديل
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
            const canEditChild = !!user && (user.id === ch.author_id || isAdmin);
            return (
              <ChildCommentItem
                key={ch.id}
                ch={ch}
                cn={cn}
                canEdit={canEditChild}
                canDelete={canDelete(ch.author_id)}
                onDelete={onDelete}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChildCommentItem({
  ch,
  cn,
  canEdit,
  canDelete,
  onDelete,
}: {
  ch: {
    id: string;
    author_id: string;
    content: string;
    created_at: string;
    author: CommentAuthor | null;
  };
  cn: string;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (cid: string) => void;
}) {
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(ch.content);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("comments")
        .update({ content: editText.trim() })
        .eq("id", ch.id);
      if (error) throw error;
      toast.success("تم تعديل التعليق الفرعي بنجاح");
      setIsEditing(false);
      qc.invalidateQueries({ queryKey: ["comments"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تعديل التعليق";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <Link to="/profile/$id" params={{ id: ch.author_id }}>
            <UserAvatar avatarUrl={ch.author?.avatar_url} fullName={cn} className="w-7 h-7" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <Link
                to="/profile/$id"
                params={{ id: ch.author_id }}
                className="font-medium text-xs inline-flex items-center gap-1 hover:underline"
              >
                {cn}
                {ch.author?.verified && <VerifiedBadge />}
              </Link>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(ch.created_at), {
                  addSuffix: true,
                  locale: ar,
                })}
              </span>
            </div>

            {isEditing ? (
              <div className="mt-1.5 space-y-1.5">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="text-xs rounded-xl"
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || !editText.trim()}
                    className="h-6 text-[11px] rounded-md px-2.5"
                  >
                    {saving && <Loader2 className="w-3 h-3 animate-spin ml-1" />} حفظ
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setEditText(ch.content);
                    }}
                    className="h-6 text-[11px] rounded-md"
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm mt-0.5 whitespace-pre-wrap">{ch.content}</p>
                <CommentReactionsBar commentId={ch.id} />
              </>
            )}

            <div className="flex items-center gap-3 mt-1">
              {canEdit && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" /> تعديل
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete(ch.id)}
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
  );
}
