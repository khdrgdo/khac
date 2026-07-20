import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostWithMeta } from "@/components/PostCard";
import { Loader2 } from "lucide-react";

interface Props {
  authorId?: string;
  savedByUserId?: string;
}

export function PostList({ authorId, savedByUserId }: Props) {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["posts", { authorId, savedByUserId }],
    queryFn: async (): Promise<PostWithMeta[]> => {
      let postIds: string[] | null = null;

      if (savedByUserId) {
        const { data: saved } = await supabase
          .from("saved_posts")
          .select("post_id")
          .eq("user_id", savedByUserId);
        postIds = (saved ?? []).map((s: { post_id: string }) => s.post_id);
        if (postIds.length === 0) return [];
      }

      let q = supabase
        .from("posts")
        .select("id, content, images, author_id, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (authorId) q = q.eq("author_id", authorId);
      if (postIds) q = q.in("id", postIds);

      const { data: rows, error } = await q;
      if (error) throw error;
      const list = rows ?? [];
      if (list.length === 0) return [];

      const ids = list.map((r) => r.id);
      const authorIds = Array.from(new Set(list.map((r) => r.author_id)));

      const [{ data: authors }, { data: reactions }, { data: comments }] = await Promise.all([
        supabase.rpc("get_public_profiles", { _ids: authorIds }),
        supabase.from("post_reactions").select("post_id, user_id, reaction").in("post_id", ids),
        supabase.from("comments").select("post_id").in("post_id", ids),
      ]);

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;

      let savedSet = new Set<string>();
      if (uid) {
        const { data: saves } = await supabase
          .from("saved_posts")
          .select("post_id")
          .eq("user_id", uid)
          .in("post_id", ids);
        savedSet = new Set((saves ?? []).map((s: { post_id: string }) => s.post_id));
      }

      const authorMap = new Map((authors ?? []).map((a: { id: string } & Record<string, unknown>) => [a.id, a]));

      return list.map((r) => {
        const postReactions = (reactions ?? []).filter((x: { post_id: string }) => x.post_id === r.id);
        const commentCount = (comments ?? []).filter((x: { post_id: string }) => x.post_id === r.id).length;
        const myReaction = uid ? postReactions.find((x: { user_id: string }) => x.user_id === uid)?.reaction : null;
        return {
          ...r,
          author: authorMap.get(r.author_id) as PostWithMeta["author"],
          reactions: postReactions as PostWithMeta["reactions"],
          commentCount,
          myReaction: (myReaction ?? null) as PostWithMeta["myReaction"],
          saved: savedSet.has(r.id),
        };
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        لا توجد منشورات بعد.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}
