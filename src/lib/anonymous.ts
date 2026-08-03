import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Display name shown to normal users for anonymous content. */
export const ANON_NAME = "طالب مجهول";

export interface RevealedAuthor {
  content_id: string;
  author_id: string;
  full_name: string;
  avatar_url: string | null;
  university_number: string;
}

/**
 * Anonymous content stores its real author in `anonymous_authors`, a table only
 * admins / sub-admins (and the author themself) may read. This hook resolves the
 * hidden identity for moderators only.
 */
export function useAnonymousReveal(type: "post" | "comment", ids: string[]) {
  const { isAdmin, isSubAdmin } = useAuth();
  const canReveal = isAdmin || isSubAdmin;
  const sorted = [...new Set(ids)].sort();

  const { data } = useQuery({
    queryKey: ["anon-reveal", type, sorted.join(",")],
    enabled: canReveal && sorted.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<RevealedAuthor[]> => {
      const { data, error } = await supabase.rpc("get_anonymous_authors", {
        _type: type,
        _ids: sorted,
      });
      if (error) throw error;
      return (data ?? []) as RevealedAuthor[];
    },
  });

  const map = new Map((data ?? []).map((r) => [r.content_id, r]));
  return {
    canReveal,
    reveal: (id: string): RevealedAuthor | null => map.get(id) ?? null,
  };
}

/** Ids of anonymous posts/comments authored by the current user (so they can delete them). */
export function useMyAnonymousIds(type: "post" | "comment") {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-anon-ids", type, user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<string[]> => {
      const { data } = await supabase
        .from("anonymous_authors")
        .select("content_id")
        .eq("content_type", type)
        .eq("author_id", user!.id);
      return (data ?? []).map((r: { content_id: string }) => r.content_id);
    },
  });
  const set = new Set(data ?? []);
  return (id: string) => set.has(id);
}
