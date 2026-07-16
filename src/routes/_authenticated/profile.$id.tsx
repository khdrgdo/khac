import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PostList } from "@/components/PostList";
import { majorLabel } from "@/lib/college";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile/$id")({
  component: ProfilePage,
});

function ProfilePage() {
  const { id } = useParams({ from: "/_authenticated/profile/$id" });
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: p } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", id);
      return data ? { ...data, roles: (roles ?? []).map((r: { role: string }) => r.role) } : null;
    },
  });

  const startChat = useMutation({
    mutationFn: async () => {
      if (!user || user.id === id) return null;
      const { data: mine } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", user.id);
      const myConvs = (mine ?? []).map((m: { conversation_id: string }) => m.conversation_id);
      if (myConvs.length) {
        const { data: theirs } = await supabase
          .from("conversation_members")
          .select("conversation_id, conversations!inner(is_group)")
          .in("conversation_id", myConvs)
          .eq("user_id", id);
        const existing = (theirs ?? []).find((t: { conversations: { is_group: boolean } }) => !t.conversations.is_group);
        if (existing) return (existing as { conversation_id: string }).conversation_id;
      }
      const { data: conv, error } = await supabase.from("conversations").insert({ is_group: false, created_by: user.id }).select().single();
      if (error) throw error;
      await supabase.from("conversation_members").insert([
        { conversation_id: conv.id, user_id: user.id },
        { conversation_id: conv.id, user_id: id },
      ]);
      return conv.id;
    },
    onSuccess: (convId) => {
      if (convId) { qc.invalidateQueries({ queryKey: ["conversations"] }); navigate({ to: "/messages/$id", params: { id: convId } }); }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!p) return <div className="text-center py-10 text-sm text-muted-foreground">جارِ التحميل...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={p.avatar_url ?? undefined} />
              <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
                {p.full_name.slice(0,2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{p.full_name}</h1>
              <div className="text-sm text-muted-foreground" dir="ltr">{p.university_number}</div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {p.roles.map((r: string) => (
                  <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                    {r === "admin" ? "مشرف" : r === "teacher" ? "أستاذ" : "طالب"}
                  </Badge>
                ))}
                {p.major && <Badge variant="outline">{majorLabel(p.major)}</Badge>}
                {p.year && <Badge variant="outline">السنة {p.year}</Badge>}
              </div>
              {p.bio && <p className="mt-3 text-sm">{p.bio}</p>}
              {user && user.id !== id && (
                <Button size="sm" className="mt-3" onClick={() => startChat.mutate()} disabled={startChat.isPending}>
                  <MessageCircle className="w-4 h-4" /> مراسلة
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="font-semibold mt-4">منشورات المستخدم</h2>
      <PostList authorId={id} />
    </div>
  );
}
