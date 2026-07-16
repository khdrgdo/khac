import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { REACTIONS, majorLabel, type ReactionType } from "@/lib/college";
import { Bookmark, MessageCircle, Share2 } from "lucide-react";
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
  author: {
    id: string;
    full_name: string;
    university_number: string;
    avatar_url: string | null;
    major: string | null;
  } | undefined;
  reactions: { post_id: string; user_id: string; reaction: ReactionType }[];
  commentCount: number;
  myReaction: ReactionType | null;
  saved: boolean;
}

export function PostCard({ post }: { post: PostWithMeta }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openReact, setOpenReact] = useState(false);

  const reactMut = useMutation({
    mutationFn: async (type: ReactionType | null) => {
      if (!user) return;
      if (type === null) {
        await supabase.from("post_reactions").delete().eq("post_id", post.id).eq("user_id", user.id);
      } else {
        await supabase
          .from("post_reactions")
          .upsert({ post_id: post.id, user_id: user.id, reaction: type }, { onConflict: "post_id,user_id" });
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
    } catch {/* ignore */}
  }

  const authorName = post.author?.full_name ?? "مستخدم";

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <Link to="/profile/$id" params={{ id: post.author_id }}>
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.author?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {authorName.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <Link to="/profile/$id" params={{ id: post.author_id }} className="font-semibold hover:underline">
                {authorName}
              </Link>
              {post.author?.major && (
                <span className="text-xs text-muted-foreground">• {majorLabel(post.author.major)}</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ar })}
            </div>
          </div>
        </div>

        <Link to="/posts/$id" params={{ id: post.id }}>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{post.content}</p>
        </Link>

        {totalReactions > 0 || post.commentCount > 0 ? (
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              {topEmojis.map((e) => <span key={e.type}>{e.emoji}</span>)}
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
                onClick={() => {
                  if (post.myReaction) reactMut.mutate(null);
                  else reactMut.mutate("like");
                }}
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
                    onClick={() => { reactMut.mutate(r.type); setOpenReact(false); }}
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
    </Card>
  );
}
