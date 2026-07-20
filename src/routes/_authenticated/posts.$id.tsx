import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isSuspended } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/posts/$id")({
  component: PostDetailPage,
});

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
      const { data: authorRows } = await supabase.rpc("get_public_profiles", { _ids: [p.author_id] });
      const author = (authorRows && authorRows[0]) ?? null;
      return { ...p, author };
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", id],
    queryFn: async (): Promise<(Comment & { author: { full_name: string; avatar_url: string | null } | null })[]> => {
      const { data: rows } = await supabase.from("comments").select("*").eq("post_id", id).order("created_at");
      const list = rows ?? [];
      if (list.length === 0) return [];
      const ids = Array.from(new Set(list.map((r: Comment) => r.author_id)));
      const { data: authors } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids);
      const map = new Map((authors ?? []).map((a) => [a.id, a]));
      return list.map((c: Comment) => ({ ...c, author: (map.get(c.author_id) as { full_name: string; avatar_url: string | null }) ?? null }));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`post-${id}-comments`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["comments", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [text, setText] = useState("");

  const commentMut = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (suspended) throw new Error("حسابك موقوف مؤقتًا — لا يمكن التعليق");
      const { error } = await supabase.from("comments").insert({
        post_id: id, author_id: user.id, content: text.trim(), parent_id: replyTo,
      });
      if (error) throw error;
    },
    onSuccess: () => { setText(""); setReplyTo(null); qc.invalidateQueries({ queryKey: ["comments", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteComment = useMutation({
    mutationFn: async (cid: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", cid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", id] }),
  });

  if (!post) return <div className="text-center py-10 text-sm text-muted-foreground">جارِ التحميل...</div>;

  const roots = (comments ?? []).filter((c) => !c.parent_id);
  const childrenOf = (pid: string) => (comments ?? []).filter((c) => c.parent_id === pid);
  const authorName = post.author?.full_name ?? "مستخدم";

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link to="/feed" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowRight className="w-4 h-4" /> العودة
      </Link>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.author?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">{authorName.slice(0,2)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">{authorName}</div>
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ar })}
              </div>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[15px]">{post.content}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-3">
          {replyTo && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              يجري الرد على تعليق <button className="text-primary" onClick={() => setReplyTo(null)}>إلغاء</button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="اكتب تعليقًا..." className="resize-none" />
            <Button onClick={() => commentMut.mutate()} disabled={!text.trim() || commentMut.isPending} size="sm">
              {commentMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {roots.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">لا توجد تعليقات بعد.</div>}
        {roots.map((c) => (
          <CommentItem
            key={c.id}
            c={c}
            children={childrenOf(c.id)}
            onReply={(cid) => setReplyTo(cid)}
            onDelete={(cid) => deleteComment.mutate(cid)}
            canDelete={(a) => a === user?.id || isAdmin}
          />
        ))}
      </div>
    </div>
  );
}

function CommentItem({
  c, children, onReply, onDelete, canDelete,
}: {
  c: { id: string; author_id: string; content: string; created_at: string; author: { full_name: string; avatar_url: string | null } | null };
  children: { id: string; author_id: string; content: string; created_at: string; author: { full_name: string; avatar_url: string | null } | null }[];
  onReply: (cid: string) => void;
  onDelete: (cid: string) => void;
  canDelete: (authorId: string) => boolean;
}) {
  const name = c.author?.full_name ?? "مستخدم";
  return (
    <div>
      <Card>
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={c.author?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">{name.slice(0,2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-sm">{name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ar })}
                </span>
              </div>
              <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.content}</p>
              <div className="flex gap-3 mt-1">
                <button onClick={() => onReply(c.id)} className="text-xs text-muted-foreground hover:text-primary">رد</button>
                {canDelete(c.author_id) && (
                  <button onClick={() => onDelete(c.id)} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
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
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{cn.slice(0,2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-xs">{cn}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(ch.created_at), { addSuffix: true, locale: ar })}
                        </span>
                      </div>
                      <p className="text-sm mt-0.5 whitespace-pre-wrap">{ch.content}</p>
                      {canDelete(ch.author_id) && (
                        <button onClick={() => onDelete(ch.id)} className="text-xs text-muted-foreground hover:text-destructive mt-1 flex items-center gap-1">
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
