import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { REACTIONS, majorLabel, type ReactionType } from "@/lib/college";
import {
  Bookmark,
  Flag,
  MessageCircle,
  MoreHorizontal,
  Share2,
  HelpCircle,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { RankBadge } from "@/components/RankBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { StorageImage } from "@/components/StorageImage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export interface PostWithMeta {
  id: string;
  content: string;
  images: string[] | null;
  author_id: string;
  created_at: string;
  post_type: "general" | "question";
  accepted_answer_id: string | null;
  author:
    | {
        id: string;
        full_name: string;
        university_number: string;
        avatar_url: string | null;
        major: string | null;
        points?: number | null;
        verified?: boolean;
      }
    | undefined;
  reactions: { post_id: string; user_id: string; reaction: ReactionType }[];
  commentCount: number;
  myReaction: ReactionType | null;
  saved: boolean;
}

const REPORT_REASONS = [
  "محتوى غير لائق أو مسيء",
  "تنمّر أو تحرّش",
  "معلومات مضللة",
  "بريد مزعج / إعلان",
  "أخرى",
];

export function PostCard({ post }: { post: PostWithMeta }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [openReact, setOpenReact] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const deletePostMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast.success("تم حذف المنشور بنجاح");
      if (window.location.pathname.includes(`/posts/${post.id}`)) {
        navigate({ to: "/feed" });
      }
    },
    onError: (e: Error) => toast.error(e.message || "فشل في حذف المنشور"),
  });

  const reactMut = useMutation({
    mutationFn: async (type: ReactionType | null) => {
      if (!user) return;
      if (type === null) {
        await supabase
          .from("post_reactions")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("post_reactions")
          .upsert(
            { post_id: post.id, user_id: user.id, reaction: type },
            { onConflict: "post_id,user_id" },
          );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (post.saved) {
        await supabase.from("saved_posts").delete().eq("post_id", post.id).eq("user_id", user.id);
      } else {
        await supabase.from("saved_posts").insert({ post_id: post.id, user_id: user.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast.success(post.saved ? "أُزيل من المحفوظات" : "تمّ الحفظ");
    },
  });

  const counts: Record<string, number> = {};
  for (const r of post.reactions) counts[r.reaction] = (counts[r.reaction] ?? 0) + 1;
  const totalReactions = post.reactions.length;
  const topEmojis = REACTIONS.filter((r) => counts[r.type]).slice(0, 3);

  async function share() {
    const url = `${window.location.origin}/posts/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ url, text: post.content.slice(0, 100) });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("تم نسخ الرابط");
      }
    } catch {
      /* ignore */
    }
  }

  const authorName = post.author?.full_name ?? "مستخدم";

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <Link to="/profile/$id" params={{ id: post.author_id }}>
            <UserAvatar
              avatarUrl={post.author?.avatar_url}
              fullName={authorName}
              className="w-10 h-10"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to="/profile/$id"
                params={{ id: post.author_id }}
                className="font-semibold hover:underline flex items-center gap-1"
              >
                {authorName}
                {post.author?.verified && <VerifiedBadge />}
              </Link>
              <RankBadge points={post.author?.points ?? 0} size="xs" />
              {post.author?.major && (
                <span className="text-xs text-muted-foreground">
                  • {majorLabel(post.author.major)}
                </span>
              )}
              {post.post_type === "question" &&
                (post.accepted_answer_id ? (
                  <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> محلول
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    <HelpCircle className="w-3 h-3" /> سؤال مفتوح
                  </span>
                ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ar })}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {user && user.id !== post.author_id && (
                <DropdownMenuItem onClick={() => setReportOpen(true)} className="text-destructive">
                  <Flag className="w-4 h-4 ml-2" /> بلاغ
                </DropdownMenuItem>
              )}
              {user && (user.id === post.author_id || isAdmin) && (
                <DropdownMenuItem
                  onClick={() => {
                    if (window.confirm("هل أنت متأكد من رغبتك في حذف هذا المنشور؟")) {
                      deletePostMut.mutate();
                    }
                  }}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 ml-2 text-destructive" /> حذف المنشور
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Link to="/posts/$id" params={{ id: post.id }}>
          {post.content && (
            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{post.content}</p>
          )}
          {post.images && post.images.length > 0 && (
            <div
              className={cn(
                "mt-3 grid gap-1 rounded-lg overflow-hidden",
                post.images.length === 1 ? "grid-cols-1" : "grid-cols-2",
              )}
            >
              {post.images.slice(0, 4).map((p) => (
                <StorageImage
                  key={p}
                  bucket="post-images"
                  path={p}
                  className={cn(
                    "w-full object-cover",
                    post.images!.length === 1 ? "max-h-96" : "h-40",
                  )}
                />
              ))}
            </div>
          )}
        </Link>

        {totalReactions > 0 || post.commentCount > 0 ? (
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              {topEmojis.map((e) => (
                <span key={e.type}>{e.emoji}</span>
              ))}
              {totalReactions > 0 && <span className="ms-1">{totalReactions}</span>}
            </div>
            {post.commentCount > 0 && <span>{post.commentCount} تعليق</span>}
          </div>
        ) : null}

        <div className="mt-2 pt-2 border-t flex items-center gap-1">
          <Popover open={openReact} onOpenChange={setOpenReact}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn("flex-1 gap-1", post.myReaction && "text-primary")}
                onClick={() => (post.myReaction ? reactMut.mutate(null) : reactMut.mutate("like"))}
              >
                {post.myReaction ? (
                  <>
                    <span>{REACTIONS.find((r) => r.type === post.myReaction)?.emoji}</span>
                    {REACTIONS.find((r) => r.type === post.myReaction)?.label}
                  </>
                ) : (
                  <>👍 إعجاب</>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1" side="top">
              <div className="flex gap-1">
                {REACTIONS.map((r) => (
                  <button
                    key={r.type}
                    onClick={() => {
                      reactMut.mutate(r.type);
                      setOpenReact(false);
                    }}
                    className="text-2xl hover:scale-125 transition-transform p-1"
                    title={r.label}
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="sm" className="flex-1 gap-1" asChild>
            <Link to="/posts/$id" params={{ id: post.id }}>
              <MessageCircle className="w-4 h-4" /> تعليق
            </Link>
          </Button>

          <Button variant="ghost" size="sm" className="flex-1 gap-1" onClick={share}>
            <Share2 className="w-4 h-4" /> مشاركة
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-1", post.saved && "text-primary")}
            onClick={() => saveMut.mutate()}
          >
            <Bookmark className={cn("w-4 h-4", post.saved && "fill-current")} />
          </Button>
        </div>
      </CardContent>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} postId={post.id} />
    </Card>
  );
}

function ReportDialog({
  open,
  onOpenChange,
  postId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  postId: string;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!user) return;
    setLoading(true);
    const fullReason = note.trim() ? `${reason} — ${note.trim()}` : reason;
    const { error } = await supabase
      .from("post_reports")
      .insert({ post_id: postId, reporter_id: user.id, reason: fullReason });
    setLoading(false);
    if (error) {
      if (error.code === "23505") toast.info("لقد أبلغت عن هذا المنشور مسبقًا");
      else toast.error(error.message);
      return;
    }
    toast.success("تم إرسال البلاغ، سيراجعه المشرفون");
    onOpenChange(false);
    setNote("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-4 h-4" /> بلاغ عن منشور
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                {r}
              </label>
            ))}
          </div>
          <Textarea
            placeholder="تفاصيل إضافية (اختياري)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={300}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={loading} variant="destructive">
            إرسال البلاغ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
