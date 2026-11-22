import { formatUnivNumber } from "@/lib/privacy";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { REACTIONS, majorLabel, type ReactionType } from "@/lib/college";
import { createNotification } from "@/lib/notificationsStore";
import {
  Bookmark,
  Flag,
  MessageCircle,
  MoreHorizontal,
  Share2,
  HelpCircle,
  CheckCircle2,
  Trash2,
  VenetianMask,
  ThumbsUp,
} from "lucide-react";
import { RankBadge } from "@/components/RankBadge";
import { ANON_NAME, useAnonymousReveal, useMyAnonymousIds } from "@/lib/anonymous";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { StorageImage } from "@/components/StorageImage";
import { ExpandableText } from "@/components/ExpandableText";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export interface PostWithMeta {
  id: string;
  content: string;
  images: string[] | null;
  author_id: string | null;
  is_anonymous?: boolean;
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
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const anonymous = !!post.is_anonymous || !post.author_id;
  const { canReveal, reveal } = useAnonymousReveal("post", anonymous ? [post.id] : []);
  const isMyAnon = useMyAnonymousIds("post");


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
        const { error } = await supabase
          .from("post_reactions")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("post_reactions")
          .upsert(
            { post_id: post.id, user_id: user.id, reaction: type },
            { onConflict: "post_id,user_id" },
          );
        if (error) throw error;

        const matchedReaction = REACTIONS.find((r) => r.type === type);
        await createNotification({
          sourceType: "post",
          sourceId: post.id,
          type: "post_like",
          title: `تفاعل جديد على منشورك ${matchedReaction?.emoji || "❤️"}`,
          body: `قام أحد زملائك بالتفاعل بـ ${matchedReaction?.label || "إعجاب"} على منشورك.`,
          link: `/posts/${post.id}`,
        });
      }
    },
    onMutate: async (type) => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      const previous = qc.getQueriesData<PostWithMeta[]>({ queryKey: ["posts"] });
      qc.setQueriesData<PostWithMeta[]>(
        { queryKey: ["posts"] },
        (old) =>
          old?.map((p) => {
            if (p.id !== post.id) return p;
            if (type === null) {
              return {
                ...p,
                myReaction: null,
                reactions: p.reactions.filter((r) => r.user_id !== user?.id),
              };
            }
            const filtered = p.reactions.filter((r) => r.user_id !== user?.id);
            return {
              ...p,
              myReaction: type,
              reactions: [...filtered, { post_id: post.id, user_id: user?.id ?? "", reaction: type }],
            };
          }) ?? old,
      );
      return { previous };
    },
    onError: (_err, _type, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (post.saved) {
        const { error } = await supabase.from("saved_posts").delete().eq("post_id", post.id).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("saved_posts").insert({ post_id: post.id, user_id: user.id });
        if (error) throw error;
      }
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      const previous = qc.getQueriesData<PostWithMeta[]>({ queryKey: ["posts"] });
      qc.setQueriesData<PostWithMeta[]>(
        { queryKey: ["posts"] },
        (old) =>
          old?.map((p) => (p.id === post.id ? { ...p, saved: !p.saved } : p)) ?? old,
      );
      return { previous };
    },
    onError: (_err, _type, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
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

  const isAnon = !!post.is_anonymous || !post.author_id;
  const revealed = isAnon ? reveal(post.id) : null;
  const authorName = isAnon ? ANON_NAME : (post.author?.full_name ?? "مستخدم");
  const profileLinkId = isAnon ? null : post.author_id;
  const isMine = !!user && (user.id === post.author_id || (isAnon && isMyAnon(post.id)));

  const avatarEl = (
    <UserAvatar
      avatarUrl={isAnon ? null : post.author?.avatar_url}
      fullName={isAnon ? "؟" : authorName}
      className="w-11 h-11 ring-2 ring-background"
    />
  );

  return (
    <Card className="animate-rise">
      <CardContent className="p-4 pb-1.5">
        <div className="flex items-start gap-3">
          {profileLinkId ? (
            <Link to="/profile/$id" params={{ id: profileLinkId }}>{avatarEl}</Link>
          ) : (
            avatarEl
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {profileLinkId ? (
                <Link
                  to="/profile/$id"
                  params={{ id: profileLinkId }}
                  className="font-semibold hover:underline flex items-center gap-1"
                >
                  {authorName}
                  {post.author?.verified && <VerifiedBadge />}
                </Link>
              ) : (
                <span className="font-semibold flex items-center gap-1">
                  <VenetianMask className="w-4 h-4 text-muted-foreground" />
                  {authorName}
                </span>
              )}
              {!isAnon && <RankBadge points={post.author?.points ?? 0} size="xs" />}
              {isAnon && canReveal && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                  {revealed
                    ? `الهوية (للإدارة فقط): ${revealed.full_name}`
                    : "منشور مجهول"}
                </span>
              )}
              {!isAnon && post.author?.major && (
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
              {user && !isMine && (
                <DropdownMenuItem onClick={() => setReportOpen(true)} className="text-destructive">
                  <Flag className="w-4 h-4 ml-2" /> بلاغ
                </DropdownMenuItem>
              )}
              {user && (isMine || isAdmin) && (
                <DropdownMenuItem
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 ml-2 text-destructive" /> حذف المنشور
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>


        <Link to="/posts/$id" params={{ id: post.id }}>
          {post.content && <ExpandableText text={post.content} className="mt-3" />}
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
          <div className="flex items-center justify-between mt-3 text-[13px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5 space-x-reverse">
                {topEmojis.map((e) => (
                  <span key={e.type} className="grid h-5 w-5 place-items-center rounded-full bg-popover text-[12px] ring-2 ring-popover">
                    {e.emoji}
                  </span>
                ))}
              </div>
              {totalReactions > 0 && <span>{totalReactions}</span>}
            </div>
            {post.commentCount > 0 && (
              <Link to="/posts/$id" params={{ id: post.id }} className="hover:underline">
                {post.commentCount} تعليق
              </Link>
            )}
          </div>
        ) : null}

        <div className="mt-2.5 pt-1 border-t flex items-center">
          <ReactionButton
            myReaction={post.myReaction as ReactionType | null | undefined}
            onReact={(r) => reactMut.mutate(r)}
          />
          <ActionButton asLink postId={post.id} icon={<MessageCircle className="w-[18px] h-[18px]" />} label="تعليق" />
          <ActionButton onClick={share} icon={<Share2 className="w-[18px] h-[18px]" />} label="مشاركة" />
          <button
            type="button"
            onClick={() => saveMut.mutate()}
            aria-label="حفظ"
            className={cn(
              "grid h-9 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary",
              post.saved && "text-primary",
            )}
          >
            <Bookmark className={cn("w-[18px] h-[18px]", post.saved && "fill-current")} />
          </button>
        </div>
      </CardContent>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} postId={post.id} />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من رغبتك في حذف هذا المنشور؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletePostMut.mutate()}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

const REACTION_TONE: Record<string, string> = {
  like: "text-react-like",
  love: "text-react-love",
  haha: "text-react-warm",
  wow: "text-react-warm",
  sad: "text-react-warm",
};

function ActionButton({
  icon,
  label,
  onClick,
  asLink,
  postId,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  asLink?: boolean;
  postId?: string;
}) {
  const cls =
    "flex flex-1 items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary";
  if (asLink && postId)
    return (
      <Link to="/posts/$id" params={{ id: postId }} className={cls}>
        {icon} {label}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {icon} {label}
    </button>
  );
}

/** Facebook-style: tap = like/unlike, hover or long-press = floating reaction dock. */
function ReactionButton({
  myReaction,
  onReact,
}: {
  myReaction: ReactionType | null | undefined;
  onReact: (r: ReactionType | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const current = REACTIONS.find((r) => r.type === myReaction);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const openSoon = (ms: number) => {
    clear();
    timer.current = setTimeout(() => {
      longPressed.current = true;
      setOpen(true);
    }, ms);
  };
  const closeSoon = () => {
    clear();
    timer.current = setTimeout(() => setOpen(false), 350);
  };
  useEffect(() => clear, []);

  return (
    <div
      className="relative flex-1"
      onMouseEnter={() => openSoon(450)}
      onMouseLeave={closeSoon}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="absolute bottom-full right-0 z-30 mb-2 flex items-end gap-0.5 rounded-full border bg-popover px-2 py-1.5 shadow-xl"
            onMouseEnter={clear}
            onMouseLeave={closeSoon}
          >
            {REACTIONS.map((r, i) => (
              <motion.button
                key={r.type}
                type="button"
                initial={{ opacity: 0, y: 12, scale: 0.5 }}
                animate={{ opacity: 1, y: 0, scale: hovered === r.type ? 1.45 : 1 }}
                transition={{ type: "spring", stiffness: 520, damping: 22, delay: i * 0.03 }}
                onMouseEnter={() => setHovered(r.type)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  onReact(r.type);
                  setOpen(false);
                }}
                className="relative grid h-10 w-10 origin-bottom place-items-center text-[28px] leading-none"
                aria-label={r.label}
              >
                {hovered === r.type && (
                  <span className="absolute -top-7 whitespace-nowrap rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-background">
                    {r.label}
                  </span>
                )}
                {r.emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold transition-colors hover:bg-secondary select-none",
          current ? REACTION_TONE[current.type] : "text-muted-foreground font-medium",
        )}
        onTouchStart={() => {
          longPressed.current = false;
          openSoon(420);
        }}
        onTouchEnd={clear}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          clear();
          setOpen(false);
          onReact(current ? null : "like");
        }}
      >
        <motion.span key={current?.type ?? "none"} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 14 }} className="text-base leading-none">
          {current ? current.emoji : <ThumbsUp className="w-[18px] h-[18px]" />}
        </motion.span>
        {current ? current.label : "إعجاب"}
      </button>
    </div>
  );
}
